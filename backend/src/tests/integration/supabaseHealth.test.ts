import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';
import { SupabaseClient } from '@supabase/supabase-js';
import { HealthMonitor } from '../../services/healthMonitor';

// Create mock with proper typing for Supabase client
type MockSupabase = {
  rpc: jest.MockedFunction<SupabaseClient['rpc']>;
  storage: {
    getBucket: jest.MockedFunction<SupabaseClient['storage']['getBucket']>;
  };
};

const createMockSupabase = (): MockSupabase => ({
  rpc: jest.fn(),
  storage: {
    getBucket: jest.fn()
  }
});

describe('Supabase Connection Tests', () => {
  let mockSupabase: MockSupabase;
  let healthMonitor: HealthMonitor;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    healthMonitor = new HealthMonitor(mockSupabase as unknown as SupabaseClient, {});
  });

  it('should successfully connect to database', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: 1,
      error: null,
      status: 200,
      statusText: 'OK',
      count: null
    });
    
    const result = await healthMonitor.checkDatabase();
    expect(result).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('ping');
  });

  it('should verify storage bucket exists', async () => {
    mockSupabase.storage.getBucket.mockResolvedValueOnce({
      data: {
        id: 'resumes',
        name: 'resumes',
        owner: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        public: false
      },
      error: null
    });
    
    const result = await healthMonitor.checkStorage();
    expect(result).toBe(true);
    expect(mockSupabase.storage.getBucket).toHaveBeenCalledWith('resumes');
  });

  it('should handle database connection errors', async () => {
    mockSupabase.rpc.mockRejectedValueOnce(new Error('Database ping failed'));
    await expect(healthMonitor.checkDatabase()).rejects.toThrow('Database ping failed');
  });

  it('should handle storage connection errors', async () => {
    mockSupabase.storage.getBucket.mockRejectedValueOnce(new Error('Storage bucket missing'));
    await expect(healthMonitor.checkStorage()).rejects.toThrow('Storage bucket missing');
  });

  afterAll(() => {
    jest.clearAllMocks();
  });
});