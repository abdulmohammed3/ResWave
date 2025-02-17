import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { SERVER, RATE_LIMIT } from './config';
import { errorHandler } from './middleware/errorHandler';
import filesRouter from './routes/files';
import paymentsRouter from './routes/payments';
import { storage, ollama } from './services';
import { getServiceStatus, ensureOllamaRunning } from './utils/service-recovery';

export async function createServer() {
  const app = express();

  // Initialize storage
  await storage.initialize();

  // Middleware
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }));
  app.use(express.json());
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: RATE_LIMIT.WINDOW_MS,
    max: RATE_LIMIT.MAX_REQUESTS,
    message: RATE_LIMIT.MESSAGE
  });
  app.use(limiter);

  // Routes
  app.use('/api/v1/files', filesRouter);
  app.use('/api/v1/payments', paymentsRouter);

  // Health check
  app.get('/health', async (_, res) => {
    try {
      const [serviceStatus, storageStatus] = await Promise.all([
        getServiceStatus(),
        storage.checkHealth()
      ]);

      // If Ollama is not running or unhealthy, try to recover
      if (!serviceStatus.ollama.healthy) {
        console.log('Attempting to recover Ollama service...');
        await ensureOllamaRunning();
        // Get updated status after recovery attempt
        serviceStatus.ollama = {
          ...(await getServiceStatus()).ollama
        };
      }

      const status = (serviceStatus.ollama.healthy && storageStatus) ? 'healthy' : 'degraded';
      
      res.json({
        status,
        services: {
          ollama: serviceStatus.ollama.status,
          storage: storageStatus ? 'available' : 'unavailable'
        },
        details: {
          ollama: {
            running: serviceStatus.ollama.running,
            healthy: serviceStatus.ollama.healthy
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: 'error',
        services: {
          ollama: 'error',
          storage: 'error'
        },
        timestamp: new Date().toISOString()
      });
    }
  });

  // Error handling
  app.use(errorHandler);

  return app;
}

export async function startServer() {
  try {
    const app = await createServer();
    let port = SERVER.DEFAULT_PORT;
    let attempts = 0;

    while (attempts < SERVER.MAX_PORT_ATTEMPTS) {
      try {
        await new Promise<void>((resolve, reject) => {
          const server = app.listen(port, () => {
            console.log(`Server running on port ${port}`);
            resolve();
          }).on('error', (err) => {
            reject(err);
          });

          // Graceful shutdown
          process.on('SIGTERM', () => {
            console.log('SIGTERM signal received: closing server');
            server.close(() => {
              console.log('Server closed');
              process.exit(0);
            });
          });
        });
        break;
      } catch (err) {
        attempts++;
        port++;
        console.log(`Port ${port - 1} in use, trying ${port}`);
      }
    }

    if (attempts === SERVER.MAX_PORT_ATTEMPTS) {
      throw new Error('Unable to find an available port');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if running directly
if (require.main === module) {
  startServer();
}
