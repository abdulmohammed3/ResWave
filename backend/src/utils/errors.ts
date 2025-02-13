// Custom error types and handling utilities

export interface ErrorContext {
  stage: string;
  hasFile?: boolean;
  fileReceived?: boolean;
  processingStatus: string;
  timestamp: string;
}

export class OptimizationError extends Error {
  constructor(
    message: string,
    public context?: ErrorContext,
    public cause?: Error
  ) {
    super(message);
    this.name = 'OptimizationError';
  }
}

export interface ErrorState {
  type: string;
  message: string;
  time_elapsed: number;
}

export interface ErrorResponse {
  error: string;
  context?: ErrorContext;
  metadata?: {
    retryCount?: number;
    processingTime?: number;
  };
}

export function createErrorResponse(
  error: Error | unknown,
  startTime: number,
  retryCount: number = 0
): { statusCode: number; response: ErrorResponse } {
  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      if (err.message === 'Request timed out') {
        return 'Request timed out. The model is taking too long to respond.';
      }
      if ('cause' in err && (err.cause as { code?: string })?.code === 'UND_ERR_HEADERS_TIMEOUT') {
        return 'Network timeout. The server is not responding.';
      }
      return err.message;
    }
    return 'Internal server error';
  };

  const getStatusCode = (err: unknown): number => {
    if (err instanceof OptimizationError) {
      return 422; // Unprocessable Entity
    }
    if (err instanceof Error) {
      if (err.message === 'Request timed out' || 
          ('cause' in err && (err.cause as { code?: string })?.code === 'UND_ERR_HEADERS_TIMEOUT')) {
        return 504; // Gateway Timeout
      }
    }
    return 500; // Internal Server Error
  };

  const statusCode = getStatusCode(error);
  const errorMessage = getErrorMessage(error);

  const response: ErrorResponse = {
    error: errorMessage,
    metadata: {
      retryCount,
      processingTime: Date.now() - startTime
    }
  };

  if (error instanceof OptimizationError && error.context) {
    response.context = error.context;
  }

  return { statusCode, response };
}

export function logError(requestId: string, error: unknown, context?: Record<string, unknown>): void {
  const errorState: ErrorState = {
    type: error instanceof Error ? error.constructor.name : 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    time_elapsed: Date.now()
  };

  console.error(`[Request ${requestId}] Error:`, {
    ...errorState,
    ...(context || {})
  });
}