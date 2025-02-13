import { TIMEOUTS, CHUNK } from '../config';

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap with a timeout
 * @param timeoutMs Timeout duration in milliseconds
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs/1000} seconds`)), timeoutMs)
    )
  ]);
}

/**
 * Implements retry logic with exponential backoff
 * @param operation Function that returns a promise to retry
 * @param maxAttempts Maximum number of retry attempts
 * @param baseDelayMs Base delay between retries in milliseconds
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = CHUNK.RETRY_ATTEMPTS,
  baseDelayMs: number = CHUNK.RETRY_BASE_DELAY
): Promise<T> {
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
}

/**
 * Calculates appropriate timeout based on content size
 * @param contentSize Size of the content in characters
 */
export function calculateTimeout(contentSize: number): number {
  return Math.min(
    TIMEOUTS.BASE_MODEL + (contentSize * TIMEOUTS.CHAR_TIME),
    TIMEOUTS.MAX_MODEL
  );
}

/**
 * Process items concurrently with a limit
 * @param items Array of items to process
 * @param processItem Function to process each item
 * @param concurrentLimit Maximum number of concurrent operations
 */
export async function processWithConcurrencyLimit<T>(
  items: any[],
  processItem: (item: any) => Promise<T>,
  concurrentLimit: number = CHUNK.CONCURRENT_LIMIT
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < items.length; i += concurrentLimit) {
    const chunk = items.slice(i, i + concurrentLimit);
    const chunkResults = await Promise.all(
      chunk.map(item => processItem(item))
    );
    results.push(...chunkResults);
  }
  return results;
}