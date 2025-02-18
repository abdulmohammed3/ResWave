import axios from 'axios';
import { OptimizationError, OllamaError, ErrorTypes } from '../utils/errors';

export class OllamaService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async checkHealth(): Promise<boolean> {
    try {
      // First verify if Ollama server is responding
      const healthResponse = await axios.get(`${this.baseUrl}/api/health`, {
        timeout: 5000
      });

      if (healthResponse.status !== 200) {
        throw new OllamaError('Ollama server health check failed', ErrorTypes.CONNECTION_ERROR, healthResponse.status);
      }

      // Then verify if the model we need is available
      const modelResponse = await axios.get(`${this.baseUrl}/api/show`, {
        params: { name: 'mistral:latest' },
        timeout: 5000
      });

      if (modelResponse.status !== 200) {
        throw new OllamaError('Model health check failed', ErrorTypes.MODEL_NOT_FOUND, modelResponse.status);
      }

      if (!modelResponse.data) {
        throw new OllamaError('Model not found', ErrorTypes.MODEL_NOT_FOUND);
      }

      return true;
    } catch (error) {
      if (error instanceof OllamaError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new OllamaError('Unable to connect to Ollama server', ErrorTypes.CONNECTION_ERROR);
        }
        if (error.code === 'ETIMEDOUT') {
          throw new OllamaError('Connection to Ollama server timed out', ErrorTypes.TIMEOUT);
        }
      }

      console.error('Ollama health check failed:', {
        message: error instanceof Error ? error.message : String(error),
        baseUrl: this.baseUrl
      });
      return false;
    }
  }

  private async retryRequest<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) break;
        
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  async optimizeResume(content: string): Promise<string> {
    try {
      const response = await this.retryRequest(async () => {
        const resp = await axios.post(`${this.baseUrl}/api/generate`, {
          model: 'mistral:latest',
          prompt: `You are a resume optimization expert. Please improve the following resume content while maintaining its structure and key information, but make it more professional and impactful:\n\n${content}`,
          stream: false
        }, {
          timeout: 120000 // 2 minute timeout for optimization
        });

        if (!resp.data.response) {
          throw new OptimizationError('No response from Ollama service', {
            stage: 'ollama_optimization',
            processingStatus: 'no_response',
            timestamp: new Date().toISOString()
          });
        }

        return resp;
      });

      return response.data.response;
    } catch (error) {
      if (error instanceof OptimizationError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new OllamaError('Unable to connect to Ollama server', ErrorTypes.CONNECTION_ERROR);
        }
        if (error.code === 'ETIMEDOUT') {
          throw new OllamaError('Optimization request timed out', ErrorTypes.TIMEOUT);
        }
      }

      throw new OptimizationError('Failed to optimize resume with Ollama', {
        stage: 'ollama_optimization',
        processingStatus: 'optimization_failed',
        timestamp: new Date().toISOString(),
        error
      });
    }
  }
}

export const ollama = new OllamaService();
