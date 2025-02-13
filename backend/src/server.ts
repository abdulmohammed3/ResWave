import express, { NextFunction } from 'express';
import cors from 'cors';
import { Ollama } from 'ollama';
import compression from 'compression';
import rateLimit, { Options as RateLimitOptions } from 'express-rate-limit';
import { SERVER, RATE_LIMIT, OLLAMA, PROMPT_TEMPLATES } from './config';
import { uploadMiddleware } from './middleware/upload';
import { errorHandler } from './middleware/errorHandler';
import { metricsTracker } from './utils/metrics';
import { withTimeout, withRetry, processWithConcurrencyLimit, calculateTimeout } from './utils/timeouts';
import { splitContent, extractTextContent, formatPrompt } from './utils/content';
import { OptimizationError } from './utils/errors';
import storageEngine from './storage';

const app = express();

// Initialize storage and start server
async function initializeServer() {
  try {
    await storageEngine.initialize();
    let PORT = process.env.PORT ? parseInt(process.env.PORT) : SERVER.DEFAULT_PORT;
    
    for (let attempt = 0; attempt < SERVER.MAX_PORT_ATTEMPTS; attempt++) {
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
        break;
      } catch (error) {
        if (attempt === SERVER.MAX_PORT_ATTEMPTS - 1) {
          throw new Error(`Failed to find an available port after ${SERVER.MAX_PORT_ATTEMPTS} attempts`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Only start the server if this file is run directly
if (require.main === module) {
  initializeServer().catch(console.error);
}

// Configure middleware
app.use(compression());
app.use(rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: RATE_LIMIT.MAX_REQUESTS,
  message: RATE_LIMIT.MESSAGE
} as RateLimitOptions));
app.use(cors());
app.use(express.json());

// Initialize Ollama client
const ollama = new Ollama({ host: OLLAMA.HOST });

// Routes
app.get('/api/optimize', (_req, res) => {
  res.status(405).json({
    error: 'Method Not Allowed',
    message: 'Please use POST method with multipart/form-data containing your resume file',
    example: 'curl -X POST -F "file=@test-resume.docx" http://localhost:3002/api/optimize'
  });
});

app.post('/api/optimize', uploadMiddleware, async (req, res, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = req.file?.requestId || Date.now().toString();
  let retryCount = 0;

  try {
    metricsTracker.incrementTotal();

    if (!req.file?.path || !req.file?.mimetype) {
      throw new OptimizationError('File processing failed');
    }

    // Extract text content from file
    const text = await extractTextContent(req.file.path);
    
    // Process content in chunks
    const contentChunks = text.length > 2000 ? splitContent(text) : [text];
    const totalChunks = contentChunks.length;
    let chunksProcessed = 0;

    // Process each chunk with retries and timeouts
    const processChunk = async (chunk: string) => {
      const prompt = formatPrompt(PROMPT_TEMPLATES.RESUME_OPTIMIZATION, { content: chunk });
      
      try {
        const response = await withRetry(async () => {
          return await withTimeout(
            ollama.generate({
              model: OLLAMA.DEFAULT_MODEL,
              prompt
            }),
            calculateTimeout(chunk.length)
          );
        });
        
        chunksProcessed++;
        return response.response;
      } catch (error) {
        retryCount++;
        throw error;
      }
    };

    // Process chunks sequentially
    const results = await processWithConcurrencyLimit(contentChunks, processChunk);
    const optimizedContent = results.join('\n\n');

    // Update metrics and send response
    const processingTime = Date.now() - startTime;
    metricsTracker.recordSuccess(processingTime);

    res.json({
      optimizedContent,
      metadata: {
        retryCount,
        processingTime,
        chunksProcessed,
        totalChunks
      }
    });
  } catch (error) {
    next(error);
  } finally {
    // Cleanup uploaded file
    if (req.file?.path) {
      await storageEngine.deleteFile(req.file.path);
    }
  }
});

app.post('/api/generate', async (req, res, next: NextFunction) => {
  const requestId = Date.now().toString();
  const startTime = Date.now();
  
  try {
    const { model = OLLAMA.DEFAULT_MODEL, text } = req.body;
    
    if (!text) {
      res.status(400).json({ error: 'Text content is required' });
      return;
    }

    const prompt = formatPrompt(PROMPT_TEMPLATES.DETAILED_OPTIMIZATION, { content: text });
    const timeout = calculateTimeout(text.length);
    
    const response = await withTimeout(
      ollama.generate({ model, prompt }),
      timeout
    );

    res.json({
      optimizedContent: response.response,
      metadata: {
        processingTime: Date.now() - startTime
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await withTimeout(ollama.list(), 2000);
    res.json({ status: 'healthy' });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/metrics', (_req, res) => {
  res.json(metricsTracker.getMetrics());
});

// Error handling middleware
app.use(errorHandler);

// Export for testing
export default app;
