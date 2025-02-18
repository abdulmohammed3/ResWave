import { exec } from 'child_process';
import { promisify } from 'util';
import { ollama } from '../services';
import { OllamaError, ErrorTypes } from './errors';

const execAsync = promisify(exec);

export async function checkOllamaProcess(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('ps aux | grep ollama | grep -v grep');
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

export async function waitForOllamaHealth(
  maxAttempts: number = 5,
  delayMs: number = 2000
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const isHealthy = await ollama.checkHealth();
      if (isHealthy) {
        return true;
      }
    } catch (error) {
      if (error instanceof OllamaError) {
        if (error.type === ErrorTypes.CONNECTION_ERROR || error.type === ErrorTypes.TIMEOUT) {
          console.log(`Attempt ${attempt + 1}/${maxAttempts} failed, retrying in ${delayMs}ms...`);
        } else if (error.type === ErrorTypes.MODEL_NOT_FOUND) {
          console.error('Required model not found in Ollama server');
          return false;
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

export async function ensureOllamaRunning(): Promise<boolean> {
  try {
    const isRunning = await checkOllamaProcess();
    if (!isRunning) {
      try {
        await execAsync('ollama serve > /dev/null 2>&1 &');
        // Wait for service to start and become healthy
        const isHealthy = await waitForOllamaHealth();
        if (!isHealthy) {
          console.error('Failed to verify Ollama health after startup');
          return false;
        }
        return true;
      } catch (error) {
        console.error('Failed to start Ollama:', error);
        return false;
      }
    }
    
    // If process is running, verify health
    try {
      return await ollama.checkHealth();
    } catch (error) {
      if (error instanceof OllamaError) {
        console.error(`Ollama health check failed: ${error.message} (${error.type})`);
      } else {
        console.error('Unexpected error during health check:', error);
      }
      return false;
    }
  } catch (error) {
    console.error('Error in ensureOllamaRunning:', error);
    return false;
  }
}

export async function getServiceStatus() {
  const ollamaRunning = await checkOllamaProcess();
  let ollamaHealthy = false;
  let status = 'unavailable';
  
  if (ollamaRunning) {
    try {
      ollamaHealthy = await ollama.checkHealth();
      status = ollamaHealthy ? 'available' : 'degraded';
    } catch (error) {
      if (error instanceof OllamaError) {
        switch (error.type) {
          case ErrorTypes.MODEL_NOT_FOUND:
            status = 'degraded';
            break;
          case ErrorTypes.CONNECTION_ERROR:
          case ErrorTypes.TIMEOUT:
            status = 'unavailable';
            break;
          default:
            status = 'error';
        }
      }
    }
  }

  return {
    ollama: {
      running: ollamaRunning,
      healthy: ollamaHealthy,
      status
    }
  };
}
