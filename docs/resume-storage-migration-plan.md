# ResWave Storage Modernization Implementation Guide

## 1. Supabase Architecture

### 1.1 Core Tables Schema (SQL)
```sql
-- Enhanced Files Table with TSVECTOR for search
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  content_tsvector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  storage_path TEXT GENERATED ALWAYS AS (
    'user_uploads/' || user_id || '/' || id || '/v{version}/' || original_filename
  ) STORED
);

-- Version History with Differential Storage
CREATE TABLE resume_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  delta_storage_path TEXT,
  full_storage_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_version_id UUID REFERENCES resume_versions(version_id)
);

-- Security Policies
CREATE POLICY "Resume owner access" ON resumes
FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Versioned resume access" ON resume_versions  
FOR SELECT USING (
  EXISTS(SELECT 1 FROM resumes WHERE id = resume_id AND user_id = auth.uid()::text)
);
```

### 1.2 Storage Bucket Configuration
```bash
# Create optimized bucket with lifecycle rules
supabase storage create resumes \
  --public false \
  --file-size-limit 50MB \
  --allowed-mime-types "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" \
  --lifecycle-rule '{"name":"auto-delete","match":"*","keep_last":"5"}'
```

## 2. Health Check System

### 2.1 Health Endpoint Implementation
```typescript
interface HealthCheck {
  database: boolean;
  storage: boolean;
  model: boolean;
  queueDepth: number;
  lastCheck: Date;
}

class HealthMonitor {
  async performHealthCheck(): Promise<HealthCheck> {
    const [db, storage, model, queue] = await Promise.all([
      this.checkDatabase(),
      this.checkStorage(),
      this.checkModel(),
      this.checkQueue()
    ]);

    return {
      database: db.healthy,
      storage: storage.connected,
      model: model.available,
      queueDepth: queue.pending,
      lastCheck: new Date()
    };
  }

  private async checkDatabase() {
    const { data, error } = await supabase.rpc('select 1');
    return { healthy: !error && data === 1 };
  }

  private async checkStorage() {
    const { data, error } = await supabase.storage.getBucket('resumes');
    return { connected: !error && data?.name === 'resumes' };
  }
}
```

## 3. Migration Phases

### 3.1 Phase 1 - Dual Write
```typescript
async migrateFile(userId: string, fileId: string) {
  // 1. Lock local file
  const localFile = await localStorage.getFile(fileId);
  
  // 2. Upload to Supabase
  const supabasePath = `migrations/${userId}/${fileId}`;
  const { error } = await supabase.storage
    .from('resumes')
    .upload(supabasePath, localFile.stream());

  // 3. Atomic metadata transfer
  await supabase.rpc('transfer_file_metadata', {
    p_user_id: userId,
    p_file_id: fileId,
    p_supabase_path: supabasePath
  });

  // 4. Verify checksum
  const localHash = await calculateHash(localFile);
  const remoteHash = await supabase.storage
    .from('resumes')
    .getFileHash(supabasePath);

  if (localHash !== remoteHash) {
    throw new MigrationError('Checksum mismatch');
  }
}
```

## 4. Error Recovery System

### 4.1 Circuit Breaker Pattern
```typescript
class OptimizationCircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute(fn: () => Promise<void>) {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > 30000) {
        this.state = 'half-open';
      } else {
        throw new CircuitOpenError();
      }
    }

    try {
      await fn();
      if (this.state === 'half-open') {
        this.reset();
      }
    } catch (err) {
      this.failures++;
      if (this.failures > 5) {
        this.state = 'open';
        this.lastFailure = Date.now();
      }
      throw err;
    }
  }
}
```

## 5. Client Integration

### 5.1 React Hook for Resume Management
```typescript
export function useResumeOptimizer() {
  const { userId } = useAuth();
  const [progress, setProgress] = useState(0);

  const optimizeResume = async (file: File) => {
    // 1. Get signed upload URL
    const { data: { session }, error } = await supabase
      .storage
      .createSignedUploadSession(`resumes/${userId}/${file.name}`);
    
    // 2. Upload file directly to storage
    const formData = new FormData();
    Object.entries(session.fields).forEach(([key, val]) => {
      formData.append(key, val);
    });
    formData.append('file', file);

    const uploadResponse = await fetch(session.url, {
      method: 'POST',
      body: formData,
      onUploadProgress: (p) => {
        setProgress(Math.round((p.loaded / p.total) * 100));
      }
    });

    // 3. Trigger optimization pipeline
    const { data: optimization } = await supabase.functions.invoke('optimize-resume', {
      body: {
        filePath: session.fields.key,
        userId
      }
    });

    return optimization;
  };

  return { optimizeResume, progress };
}
```

## 6. Environment Configuration

`.env.local` Requirements:
```ini
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
OLLAMA_HEALTH_CHECK_INTERVAL=30000
MAX_FILE_SIZE_MB=50
OPTIMIZATION_TIMEOUT_MS=120000
```

## 7. Monitoring Dashboard

Required Metrics:
| Metric | Alert Threshold | Measurement |
|--------|-----------------|-------------|
| Upload Success Rate | < 95% | Prometheus counter |
| Optimization Time | > 120s | Histogram |
| Storage Latency | P99 > 500ms | Summary |
| DB Connections | > 80% pool usage | Gauge |

**Next Implementation Steps:**
1. Create migration worker service
2. Implement canary deployment strategy
3. Set up monitoring instrumentation
4. Develop rollback procedures