export class OptimizationError extends Error {
  stage: string;
  processingStatus: string;
  timestamp: string;

  constructor(message: string, metadata?: {
    stage?: string;
    processingStatus?: string;
    timestamp?: string;
  }) {
    super(message);
    this.name = 'OptimizationError';
    this.stage = metadata?.stage || 'unknown';
    this.processingStatus = metadata?.processingStatus || 'error';
    this.timestamp = metadata?.timestamp || new Date().toISOString();
  }
}

export class OllamaError extends Error {
  type: string;
  statusCode?: number;

  constructor(message: string, type: string, statusCode?: number) {
    super(message);
    this.name = 'OllamaError';
    this.type = type;
    this.statusCode = statusCode;
  }

  static isModelNotFoundError(error: any): boolean {
    return error?.message?.includes('model not found') || 
           error?.message?.includes('failed to load model');
  }

  static isConnectionError(error: any): boolean {
    return error?.message?.includes('connection refused') ||
           error?.message?.includes('network error');
  }
}

export const ErrorTypes = {
  MODEL_NOT_FOUND: 'model_not_found',
  CONNECTION_ERROR: 'connection_error',
  TIMEOUT: 'timeout',
  INVALID_RESPONSE: 'invalid_response'
} as const;