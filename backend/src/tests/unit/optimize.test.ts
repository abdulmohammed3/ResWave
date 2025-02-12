import request from 'supertest';
import express from 'express';
import { Ollama } from 'ollama';
import mammoth from 'mammoth';
import app from '../../server';
import storage from '../../storage';

// Mock external dependencies
jest.mock('ollama');
jest.mock('mammoth');
jest.mock('../../storage');

describe('Optimize Endpoint', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock successful Ollama response with full type
    (Ollama as jest.MockedClass<typeof Ollama>).prototype.generate.mockResolvedValue({
      model: 'mistral:latest',
      created_at: new Date(),
      response: 'Optimized resume content',
      done: true,
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 50,
      prompt_eval_duration: 400,
      eval_duration: 500,
      eval_count: 100,
      done_reason: 'stop',
      context: []
    });
    
    // Mock successful mammoth conversion
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({
      value: 'Original resume content'
    });
    
    // Reset storage mock
    const mockStorage = storage as jest.Mocked<typeof storage>;
    mockStorage.initialize.mockResolvedValue(undefined);
    mockStorage.saveFile.mockImplementation(async (_, metadata) => ({
      filename: `test-${metadata.filename}`,
      mimetype: metadata.mimetype || 'application/octet-stream',
      size: 1024,
      uploadedAt: new Date(),
      path: `/tmp/uploads/test-${metadata.filename}`
    }));
    mockStorage.deleteFile.mockResolvedValue(undefined);
  });

  describe('POST /api/optimize', () => {
    let storage: typeof import('../../storage').default;
    
    beforeEach(() => {
      // Import storage after mocking for each test
      storage = require('../../storage').default;
    });

    it('should return 400 when no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .set('Content-Type', 'multipart/form-data')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'No file uploaded'
      });
    });

    it('should successfully optimize a resume with metadata', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .attach('resume', Buffer.from('fake doc content'), {
          filename: 'test-resume.txt',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('optimizedContent');
      expect(response.body.optimizedContent).toBe('Optimized resume content');
      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata).toHaveProperty('processingTime');
      expect(response.body.metadata).toHaveProperty('retryCount');
      
      // Verify file handling
      expect(storage.saveFile).toHaveBeenCalled();
      expect(storage.deleteFile).toHaveBeenCalled();
      
      // Verify mammoth was called
      expect(mammoth.extractRawText).toHaveBeenCalled();
      
      // Verify Ollama was called with correct prompt
      expect(Ollama.prototype.generate).toHaveBeenCalledWith({
        model: 'mistral:latest',
        prompt: expect.stringContaining('Original resume content')
      });
    });

    it('should clean up files even when optimization fails', async () => {
      // Mock Ollama to throw an error
      (Ollama as jest.MockedClass<typeof Ollama>).prototype.generate
        .mockRejectedValueOnce(new Error('Optimization failed'));

      await request(app)
        .post('/api/optimize')
        .attach('resume', Buffer.from('fake doc content'), {
          filename: 'test-resume.txt',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        .expect(500);

      // Verify file was cleaned up
      expect(storage.deleteFile).toHaveBeenCalled();
    });

    it('should handle large content by splitting into chunks', async () => {
      // Import storage after mocking
      const storage = require('../../storage').default;
      
      // Mock a large document
      const largeContent = 'A'.repeat(5000);
      (mammoth.extractRawText as jest.Mock).mockResolvedValue({
        value: largeContent
      });

      const response = await request(app)
        .post('/api/optimize')
        .attach('resume', Buffer.from('fake large doc content'), {
          filename: 'large-resume.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        .expect(200);

      // Verify Ollama was called multiple times for chunks
      expect(Ollama.prototype.generate).toHaveBeenCalledTimes(20); // 5000 chars / 250 chunk size
      expect(storage.deleteFile).toHaveBeenCalled();
    });

    it('should retry on temporary failures', async () => {
      const tempError = new Error('Temporary failure');
      // Fail twice, succeed on third try
      (Ollama as jest.MockedClass<typeof Ollama>).prototype.generate
        .mockRejectedValueOnce(tempError)
        .mockRejectedValueOnce(tempError)
        .mockResolvedValueOnce({
          model: 'mistral:latest',
          response: 'Optimized after retry',
          created_at: new Date(),
          done: true,
          total_duration: 1000,
          load_duration: 100,
          prompt_eval_count: 50,
          prompt_eval_duration: 400,
          eval_duration: 500,
          eval_count: 100,
          done_reason: 'stop',
          context: []
        });

      const response = await request(app)
        .post('/api/optimize')
        .attach('resume', Buffer.from('fake doc content'), {
          filename: 'test-resume.txt',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        .expect(200);

      expect(response.body.optimizedContent).toBe('Optimized after retry');
      expect(response.body.metadata.retryCount).toBeGreaterThan(0);
      expect(Ollama.prototype.generate).toHaveBeenCalledTimes(3);
      expect(storage.deleteFile).toHaveBeenCalled();
    });

    it('should handle mammoth conversion errors', async () => {
      (mammoth.extractRawText as jest.Mock).mockRejectedValue(new Error('Conversion failed'));

      const response = await request(app)
        .post('/api/optimize')
        .attach('resume', Buffer.from('fake doc content'), {
          filename: 'test-resume.txt',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        .expect('Content-Type', /json/)
        .expect(422);

      expect(response.body).toEqual(expect.objectContaining({
        error: 'Failed to process document',
        metadata: expect.objectContaining({
          processingTime: expect.any(Number),
          retryCount: expect.any(Number)
        })
      }));
      
      // Verify file was cleaned up even after conversion error
      expect(storage.deleteFile).toHaveBeenCalled();
    });

    it('should handle invalid file types', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .attach('resume', Buffer.from('fake image content'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid file type. Only DOCX and TXT files are allowed.');
    });

    it('should handle Ollama timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      (timeoutError as any).cause = { code: 'UND_ERR_HEADERS_TIMEOUT' };
      (Ollama as jest.MockedClass<typeof Ollama>).prototype.generate.mockRejectedValue(timeoutError);

      const response = await request(app)
        .post('/api/optimize')
        .attach('resume', Buffer.from('fake doc content'), {
          filename: 'test-resume.txt'
        })
        .expect('Content-Type', /json/)
        .expect(504); // Changed to 504 Gateway Timeout

      expect(response.body).toEqual(expect.objectContaining({
        error: 'Network timeout. The server is not responding.',
        metadata: expect.objectContaining({
          processingTime: expect.any(Number),
          retryCount: expect.any(Number)
        })
      }));
    });

    it('should handle custom timeout errors', async () => {
      // Mock a slow response that will trigger our custom timeout
      (Ollama as jest.MockedClass<typeof Ollama>).prototype.generate.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 70000)) // Longer than our 60s timeout
      );

      const response = await request(app)
        .post('/api/optimize')
        .attach('resume', Buffer.from('fake doc content'), {
          filename: 'test-resume.txt',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        .expect(504);

      expect(response.body).toEqual(expect.objectContaining({
        error: 'Request timed out. The model is taking too long to respond.'
      }));
    });
  });

  describe('GET /api/metrics', () => {
    it('should return current metrics', async () => {
      // Make a successful request to increment metrics
      await request(app)
        .post('/api/optimize')
        .attach('resume', Buffer.from('fake doc content'), {
          filename: 'test-resume.txt',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

      const response = await request(app)
        .get('/api/metrics')
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({
        totalRequests: expect.any(Number),
        successfulRequests: expect.any(Number),
        failedRequests: expect.any(Number),
        averageProcessingTime: expect.any(Number)
      }));
    });
  });
});
