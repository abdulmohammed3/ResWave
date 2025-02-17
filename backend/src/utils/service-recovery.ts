import { exec } from 'child_process';
import { promisify } from 'util';
import { ollama } from '../services';

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
    const isHealthy = await ollama.checkHealth();
    if (isHealthy) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

export async function ensureOllamaRunning(): Promise<boolean> {
  const isRunning = await checkOllamaProcess();
  if (!isRunning) {
    try {
      await execAsync('ollama serve > /dev/null 2>&1 &');
      // Wait for service to start and become healthy
      return await waitForOllamaHealth();
    } catch (error) {
      console.error('Failed to start Ollama:', error);
      return false;
    }
  }
  return await ollama.checkHealth();
}

export async function getServiceStatus() {
  const ollamaRunning = await checkOllamaProcess();
  const ollamaHealthy = await ollama.checkHealth();

  return {
    ollama: {
      running: ollamaRunning,
      healthy: ollamaHealthy,
      status: ollamaHealthy ? 'available' : (ollamaRunning ? 'degraded' : 'unavailable')
    }
  };
}