import axios from 'axios';
import { OptimizationError } from '../utils/errors';

export class OllamaService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async checkHealth(): Promise<boolean> {
    try {
      // First try to check if Ollama server is responding
      const response = await axios.get(`${this.baseUrl}/api/health`, {
        timeout: 5000 // 5 second timeout
      });

      if (response.status !== 200) {
        return false;
      }

      // Now verify if the model we need is available
      const modelResponse = await axios.get(`${this.baseUrl}/api/show`, {
        params: { name: 'llama2' },
        timeout: 5000
      });

      return modelResponse.status === 200 && !!modelResponse.data;
    } catch (error) {
      console.error('Ollama health check failed:', {
        message: error instanceof Error ? error.message : String(error),
        baseUrl: this.baseUrl
      });
      return false;
    }
  }

  async optimizeResume(content: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: 'llama2',
        prompt: `You are a resume optimization expert. Please improve the following resume content while maintaining its structure and key information, but make it more professional and impactful:\n\n${content}`,
        stream: false
      });

      if (!response.data.response) {
        throw new Error('No response from Ollama service');
      }

      return response.data.response;
    } catch (error) {
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