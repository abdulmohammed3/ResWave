import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Ollama } from 'ollama';
import mammoth from 'mammoth';
import busboy from 'busboy';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { FileMetadata } from './storage';
import storageEngine from './storage';

// Type augmentations
import { FileInfo } from 'busboy';

const app = express();

// Initialize storage and start server
async function initializeServer() {
  try {
    await storageEngine.initialize();
    let PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    const MAX_PORT_ATTEMPTS = 10;
    
    for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
      try {
        await new Promise((resolve, reject) => {
          const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            resolve(server);
          });
          
          server.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
              console.log(`Port ${PORT} is in use, trying ${PORT + 1}...`);
              PORT++;
              server.close();
              reject(error);
            } else {
              reject(error);
            }
          });
        });
        
        // If we get here, the server started successfully
        break;
      } catch (error) {
        if (attempt === MAX_PORT_ATTEMPTS - 1) {
          throw new Error(`Failed to find an available port after ${MAX_PORT_ATTEMPTS} attempts`);
        }
        // Continue to next attempt
        continue;
      }
    }
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Only start the server if this file is run directly
if (require.main === module) {
  initializeServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

// File type validation
const isAllowedFileType = (mimetype: string): boolean => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  return allowedTypes.includes(mimetype);
};

// File size validation (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Enable compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// Basic Ollama configuration
const ollama = new Ollama({
  host: 'http://localhost:11434'
});

app.use(cors());
app.use(express.json());

// Health check interface
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  error?: string;
}

interface OptimizeResponse {
  optimizedContent: string;
  metadata?: {
    retryCount?: number;
    processingTime?: number;
    chunksProcessed?: number;
    totalChunks?: number;
  };
}

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Custom error types for better error handling
class OptimizationError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'OptimizationError';
  }
}

// Request monitoring metrics
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  averageProcessingTime: 0,
};

// Helper function to add timeout to a promise
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs/1000} seconds`)), timeoutMs)
    )
  ]);
};

// Process chunks concurrently with a limit
const processChunksWithLimit = async <T>(
  items: any[],
  processItem: (item: any) => Promise<T>,
  concurrentLimit: number
): Promise<T[]> => {
  const results: T[] = [];
  for (let i = 0; i < items.length; i += concurrentLimit) {
    const chunk = items.slice(i, i + concurrentLimit);
    const chunkResults = await Promise.all(
      chunk.map(item => processItem(item))
    );
    results.push(...chunkResults);
  }
  return results;
};

// Helper function to implement retry logic
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number,
  baseDelayMs: number
): Promise<T> => {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts) break;
      
      // Exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

app.post('/api/optimize', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let retryCount = 0;
  let fileMetadata: FileMetadata | undefined;

  try {
    metrics.totalRequests++;

    if (!req.headers['content-type']?.includes('multipart/form-data')) {
      metrics.failedRequests++;
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    let hasFile = false;
    const bb = busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_FILE_SIZE
      }
    });

    const filePromise = new Promise<FileMetadata>((resolve, reject) => {
      bb.on('file', async (name, file, info) => {
        hasFile = true;
        if (!isAllowedFileType(info.mimeType)) {
          reject(new Error('Invalid file type. Only DOCX and TXT files are allowed.'));
          return;
        }

        try {
          fileMetadata = await storageEngine.saveFile(file, {
            filename: info.filename,
            mimetype: info.mimeType
          });
          resolve(fileMetadata);
        } catch (error) {
          reject(error);
        }
      });

      bb.on('error', reject);
      bb.on('finish', () => {
        if (!hasFile) {
          reject(new Error('No file uploaded'));
        } else if (!fileMetadata) {
          reject(new Error('File processing failed'));
        }
      });
    });

    // Set up error handler before piping
    req.on('error', (error) => {
      console.error('Request error:', error);
      metrics.failedRequests++;
      res.status(500).json({ error: 'Upload failed' });
    });

    // Pipe the request to busboy
    req.pipe(bb);

    try {
      // Wait for file upload to complete
      fileMetadata = await filePromise;
    } catch (error) {
      if (error instanceof Error && error.message === 'No file uploaded') {
        metrics.failedRequests++;
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      throw error;
    }

    try {
      if (!fileMetadata.path) {
        throw new OptimizationError('Invalid file upload: missing file path');
      }

      // Convert DOCX to text with error handling
      const result = await mammoth.extractRawText({ path: fileMetadata.path })
        .catch(error => {
          throw new OptimizationError('Failed to process document', error);
        });
      const text = result.value;

      // Split large content into smaller, more manageable chunks
      const contentChunks = text.length > 2000 ? splitContent(text) : [text];
      const totalChunks = contentChunks.length;
      let optimizedContent = '';
      let chunksProcessed = 0;

      // Process chunks with optimized timeout and aggressive retry logic
      const processChunk = async (chunk: string) => {
        const operation = async () => {
          const timeout = calculateTimeout(chunk.length);
          console.log(`Processing chunk of size ${chunk.length} with timeout ${timeout}ms`);
          
          const response = await withTimeout(
            ollama.generate({
              model: 'mistral:latest',
              prompt: `Optimize this resume section to be more impactful and professional:
              ${chunk}`,
            }),
            timeout
          );
          chunksProcessed++;
          return response.response;
        };

        try {
          return await withRetry(operation, 5, 1000);
        } catch (error) {
          retryCount++;
          throw error;
        }
      };

      // Process chunks sequentially for maximum reliability
      const results = await processChunksWithLimit(contentChunks, processChunk, 1);
      optimizedContent = results.join('\n\n');

      // Update metrics and prepare response
      const processingTime = Date.now() - startTime;
      metrics.successfulRequests++;
      metrics.averageProcessingTime =
        (metrics.averageProcessingTime * (metrics.successfulRequests - 1) + processingTime) /
        metrics.successfulRequests;

      const optimizedResponse: OptimizeResponse = {
        optimizedContent,
        metadata: {
          retryCount,
          processingTime,
          chunksProcessed,
          totalChunks
        }
      };

      res.json(optimizedResponse);
    } finally {
      // Always cleanup the file after processing
      if (fileMetadata?.path) {
        await storageEngine.deleteFile(fileMetadata.path);
      }
    }
  } catch (error) {
    metrics.failedRequests++;
    
    // Capture state for error logging
    const errorState = {
      type: error instanceof Error ? error.constructor.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      time_elapsed: Date.now() - startTime
    };
    
    console.error('Optimization Error:', errorState);
    
    // Ensure file cleanup on error
    if (fileMetadata?.path) {
      await storageEngine.deleteFile(fileMetadata.path);
    }
    
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message === 'Request timed out') {
        errorMessage = 'Request timed out. The model is taking too long to respond.';
        statusCode = 504; // Gateway Timeout
      } else if ('cause' in error && (error.cause as { code?: string })?.code === 'UND_ERR_HEADERS_TIMEOUT') {
        errorMessage = 'Network timeout. The server is not responding.';
        statusCode = 504; // Gateway Timeout
      }
      
      if (error instanceof OptimizationError) {
        errorMessage = error.message;
        statusCode = 422; // Unprocessable Entity
      }
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      metadata: {
        retryCount,
        processingTime: Date.now() - startTime
      }
    });
  }
});

// Dynamic timeout calculation with increased base time for model warmup
const calculateTimeout = (chunkSize: number): number => {
  const baseTimeout = 45000; // 45 seconds base to account for model warmup
  const timeoutPerChar = 5; // 5ms per character since we're using larger chunks
  return Math.min(baseTimeout + (chunkSize * timeoutPerChar), 120000); // Max 120s
};

// Direct model generation endpoint
app.post('/api/generate', async (req: Request, res: Response) => {
  try {
    const { model = 'mistral:latest', text } = req.body;
    
    if (!text) {
      res.status(400).json({ error: 'Text content is required' });
      return;
    }

    const prompt = `Analyze and optimize this resume section to maximize professional impact. Focus on:
    - Achievement-oriented bullet points
    - Quantifiable results
    - Industry-specific keywords
    - Clear hierarchy and readability
    
    Original content:
    ${text}`;

    const timeout = calculateTimeout(text.length);
    const response = await withTimeout(
      ollama.generate({ model, prompt }),
      timeout
    );

    res.json({
      optimizedContent: response.response,
      metadata: {
        processingTime: Date.now() - req.body.startTime || 0
      }
    });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    // Simple list request to check Ollama connection
    await withTimeout(
      ollama.list(),
      2000 // 2 second timeout
    );
    res.json({ status: 'healthy' });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Monitoring endpoint
app.get('/api/metrics', (_req: Request, res: Response) => {
  res.json(metrics);
});

// Helper function to split content into chunks
function splitContent(text: string): string[] {
  const maxChunkSize = 1000; // Increased chunk size for better context preservation
  const chunks: string[] = [];
  
  // Split on paragraph breaks to maintain context
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If paragraph itself exceeds maxChunkSize, split it into smaller chunks
    if (paragraph.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      // Split large paragraph on sentences to maintain context
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      let sentenceChunk = '';
      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length <= maxChunkSize) {
          sentenceChunk += sentence;
        } else {
          if (sentenceChunk) chunks.push(sentenceChunk);
          sentenceChunk = sentence;
        }
      }
      if (sentenceChunk) chunks.push(sentenceChunk);
      continue;
    }
    
    // Normal paragraph handling
    if ((currentChunk + paragraph).length <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = paragraph;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  
  return chunks;
}

// Only start the server if this file is run directly
if (require.main === module) {
  initializeServer().catch(console.error);
}

// Export for testing
export default app;
