import axios from 'axios';
import { OptimizationError } from '../utils/errors';

export class OllamaService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
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