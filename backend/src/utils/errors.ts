export enum ErrorTypes {
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
  AUTH_ERROR = 'AUTH_ERROR'
}

interface OptimizationErrorMetadata {
  stage?: string;
  processingStatus?: string;
  timestamp?: string;
  error?: any;
  errorCode?: string;
}

export class OptimizationError extends Error {
  stage?: string;
  processingStatus?: string;
  timestamp?: string;
  errorCode?: string;

  constructor(message: string, metadata: OptimizationErrorMetadata = {}) {
    super(message);
    this.name = 'OptimizationError';
    this.stage = metadata.stage;
    this.processingStatus = metadata.processingStatus;
    this.timestamp = metadata.timestamp;
    this.errorCode = metadata.errorCode;
  }
}

export class OllamaError extends Error {
  type: ErrorTypes;
  statusCode: number;

  constructor(message: string, type: ErrorTypes = ErrorTypes.UNKNOWN, statusCode: number = 500) {
    super(message);
    this.name = 'OllamaError';
    this.type = type;
    this.statusCode = statusCode;
  }
}
