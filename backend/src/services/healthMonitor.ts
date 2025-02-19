import { SupabaseClient } from '@supabase/supabase-js';
import { CircuitBreaker } from '../utils/service-recovery';
import { collectMetrics } from '../utils/metrics';

interface HealthState {
  database: boolean;
  storage: boolean;
  model: boolean;
  queueDepth: number;
  lastCheck: Date;
  uptime: number;
  healthy: boolean;
}

import { supabase } from '../config/supabase';
import { ollama } from './ollama.service';

export class HealthMonitor {
  private circuitBreaker: CircuitBreaker;
  
  constructor(
    private supabase: SupabaseClient,
    private ollamaService: any, // Update with actual Ollama service type
    private checkInterval: number = 30000
  ) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000
    });
  }

public async performHealthCheck(): Promise<HealthState> {
    return this.circuitBreaker.execute(async () => {
      const [dbHealth, storageHealth, modelHealth] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkStorage(),
        this.checkModelHealth()
      ]);

      const healthState: HealthState = {
        database: dbHealth.status === 'fulfilled' && dbHealth.value,
        storage: storageHealth.status === 'fulfilled' && storageHealth.value,
        model: modelHealth.status === 'fulfilled' && modelHealth.value,
        queueDepth: await this.getQueueDepth(),
        lastCheck: new Date(),
        uptime: process.uptime(),
        healthy: false
      };

      healthState.healthy = healthState.database && healthState.storage && healthState.model;
      collectMetrics('health_check', healthState);
      return healthState;
    });
  }

  public async checkDatabase(): Promise<boolean> {
    try {
      // Try to query the resumes table
      const { data, error } = await this.supabase
        .from('resumes')
        .select('count')
        .limit(1);

      if (error) {
        // Check if table doesn't exist vs other errors
        if (error.message.includes('does not exist')) {
          throw new Error('Database tables not set up. Please follow setup instructions in docs/supabase-setup-instructions.md');
        }
        throw error;
      }
      return true;
    } catch (error) {
      console.error('Database connection check failed:', error);
      throw error;
    }
  }

  public async checkStorage(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage.getBucket('resumes');
      
      if (error) {
        if (error.message.includes('bucket not found') || error.message.includes('does not exist')) {
          throw new Error('Storage bucket not set up. Please follow setup instructions in docs/supabase-setup-instructions.md');
        }
        throw error;
      }
      
      if (!data?.name) {
        throw new Error('Storage bucket configuration is invalid');
      }
      
      return true;
    } catch (error) {
      console.error('Storage check failed:', error);
      throw error;
    }
  }

  private async checkModelHealth(): Promise<boolean> {
    return this.ollamaService.checkHealth();
  }

  private async getQueueDepth(): Promise<number> {
    const { count } = await this.supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    return count || 0;
  }

  startMonitoring() {
    setInterval(() => this.performHealthCheck(), this.checkInterval);
  }
}