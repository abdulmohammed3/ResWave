/**
 * Metrics tracking for server monitoring
 */

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
}

export interface ChunkMetrics {
  retryCount: number;
  processingTime: number;
  chunksProcessed: number;
  totalChunks: number;
}

class MetricsTracker {
  private metrics: RequestMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageProcessingTime: 0
  };

  /**
   * Increment total request count
   */
  incrementTotal(): void {
    this.metrics.totalRequests++;
  }

  /**
   * Record a successful request with processing time
   * @param processingTime Time taken to process the request in milliseconds
   */
  recordSuccess(processingTime: number): void {
    this.metrics.successfulRequests++;
    this.updateAverageTime(processingTime);
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.metrics.failedRequests++;
  }

  /**
   * Update average processing time
   * @param processingTime Processing time for the current request
   */
  private updateAverageTime(processingTime: number): void {
    this.metrics.averageProcessingTime = (
      this.metrics.averageProcessingTime * (this.metrics.successfulRequests - 1) +
      processingTime
    ) / this.metrics.successfulRequests;
  }

  /**
   * Get current metrics
   */
  getMetrics(): RequestMetrics {
    return { ...this.metrics };
  }
}

// Export singleton instance
export const metricsTracker = new MetricsTracker();

/**
 * Create metrics for chunk processing
 */
export function createChunkMetrics(
  retryCount: number,
  startTime: number,
  chunksProcessed: number,
  totalChunks: number
): ChunkMetrics {
  return {
    retryCount,
    processingTime: Date.now() - startTime,
    chunksProcessed,
    totalChunks
  };
}