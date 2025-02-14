interface OptimizationErrorMetadata {
  stage?: string;
  processingStatus?: string;
  timestamp?: string;
  error?: any;
}

export class OptimizationError extends Error {
  metadata: OptimizationErrorMetadata;

  constructor(message: string, metadata: OptimizationErrorMetadata = {}) {
    super(message);
    this.name = 'OptimizationError';
    this.metadata = metadata;
  }
}