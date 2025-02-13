import { OLLAMA, CHUNK } from '../config';
import { OllamaError, ErrorTypes } from './errors';

export function calculateTimeout(contentLength: number, isFirstRequest: boolean = false): number {
  if (isFirstRequest) {
    return OLLAMA.INITIAL_PROMPT_TIMEOUT;
  }
  // Base timeout plus additional time based on content length
  const baseTimeout = OLLAMA.REQUEST_TIMEOUT;
  const timePerChar = 0.05; // 50ms per character
  return Math.min(baseTimeout + contentLength * timePerChar, 120000); // Max 2 minutes
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  console.log(`[Timeout] Setting timeout for ${timeoutMs}ms`);
  
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => {
      console.log(`[Timeout] Operation timed out after ${timeoutMs}ms`);
      reject(new OllamaError(
        `Operation timed out after ${timeoutMs}ms`,
        ErrorTypes.TIMEOUT
      ));
    }, timeoutMs)
  );

  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    if (error instanceof OllamaError) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('timed out')) {
      throw new OllamaError(
        `Operation timed out after ${timeoutMs}ms`,
        ErrorTypes.TIMEOUT
      );
    }
    throw error;
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = OLLAMA.MAX_RETRIES,
  delayMs: number = OLLAMA.RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt}/${maxAttempts}`);
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error instanceof OllamaError) {
        if (error.type === ErrorTypes.MODEL_NOT_FOUND) {
          console.error(`[Retry] Fatal error - model not found:`, error);
          throw error;
        }
      }

      if (attempt === maxAttempts) {
        console.error(`[Retry] All ${maxAttempts} attempts failed`);
        throw new OllamaError(
          `Failed after ${maxAttempts} attempts: ${error.message}`,
          ErrorTypes.CONNECTION_ERROR
        );
      }

      // Wait before retrying
      const retryDelay = delayMs * attempt;
      console.log(`[Retry] Attempt ${attempt} failed, retrying in ${retryDelay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  // This should never happen due to the throw above, but TypeScript needs it
  throw lastError || new Error('Retry failed');
}

interface ProcessingTask<R> {
  execute: () => Promise<void>;
  result?: R;
  completed: boolean;
}

export async function processWithConcurrencyLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  limit: number = CHUNK.CONCURRENCY_LIMIT
): Promise<R[]> {
  console.log(`[Concurrency] Processing ${items.length} items with limit ${limit}`);
  const results: R[] = [];
  const activeTasks = new Set<ProcessingTask<R>>();

  for (const item of items) {
    // If we've hit the limit, wait for one task to complete
    if (activeTasks.size >= limit) {
      console.log(`[Concurrency] Waiting for a task to complete (${activeTasks.size} active)`);
      await Promise.race([...activeTasks].map(task => task.execute()));
    }

    // Remove completed tasks and collect results
    for (const task of [...activeTasks]) {
      if (task.completed && task.result !== undefined) {
        results.push(task.result);
        activeTasks.delete(task);
      }
    }

    // Create new task
    const newTask: ProcessingTask<R> = {
      completed: false,
      execute: async () => {
        try {
          console.log(`[Concurrency] Starting new task (${activeTasks.size + 1} active)`);
          newTask.result = await processor(item);
          console.log(`[Concurrency] Task completed successfully`);
        } catch (error) {
          console.error(`[Concurrency] Task processing error:`, error);
          throw error;
        } finally {
          newTask.completed = true;
        }
      }
    };

    activeTasks.add(newTask);
    // Start executing the task
    newTask.execute().catch(error => {
      console.error(`[Concurrency] Task execution error:`, error);
      throw error;
    });
  }

  // Wait for any remaining tasks
  if (activeTasks.size > 0) {
    console.log(`[Concurrency] Waiting for ${activeTasks.size} remaining tasks`);
    await Promise.all([...activeTasks].map(task => task.execute()));
  }

  // Collect remaining results
  for (const task of [...activeTasks]) {
    if (task.completed && task.result !== undefined) {
      results.push(task.result);
    }
  }

  console.log(`[Concurrency] All tasks completed, collected ${results.length} results`);
  return results;
}