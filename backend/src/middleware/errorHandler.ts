import { Request, Response, NextFunction } from 'express';
import { OptimizationError, OllamaError, ErrorTypes } from '../utils/errors';

interface ErrorResponse {
  error: string;
  message: string;
  details?: {
    stage?: string;
    status?: string;
    timestamp?: string;
    type?: string;
  };
}

interface ErrorLogContext {
  timestamp: string;
  path: string;
  method: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    stage?: string;
    status?: string;
    type?: string;
    statusCode?: number;
  };
}

function createErrorResponse(error: any): ErrorResponse {
  try {
    if (error instanceof OptimizationError) {
      return {
        error: 'OptimizationError',
        message: error.message,
        details: {
          stage: error.stage,
          status: error.processingStatus,
          timestamp: error.timestamp
        }
      };
    }

    if (error instanceof OllamaError) {
      return {
        error: 'OllamaError',
        message: error.message,
        details: {
          type: error.type
        }
      };
    }
  } catch (e) {
    console.error('Error creating error response:', e);
  }

  // Default error response
  return {
    error: error?.name || 'UnknownError',
    message: error?.message || 'An unexpected error occurred'
  };
}

function logError(error: any, req: Request): void {
  const errorContext: ErrorLogContext = {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    error: {
      name: error?.name || 'UnknownError',
      message: error?.message || 'An unexpected error occurred',
      stack: error?.stack
    }
  };

  try {
    if (error instanceof OptimizationError) {
      errorContext.error = {
        ...errorContext.error,
        stage: error.stage,
        status: error.processingStatus
      };
    }

    if (error instanceof OllamaError) {
      errorContext.error = {
        ...errorContext.error,
        type: error.type,
        statusCode: error.statusCode
      };
    }
  } catch (e) {
    console.error('Error while handling error context:', e);
  }

  console.error('[ErrorHandler] Request failed:', errorContext);
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    logError(error, req);
    const errorResponse = createErrorResponse(error);
    let statusCode = 500;

    try {
      if (error instanceof OptimizationError) {
        statusCode = 400;
      } else if (error instanceof OllamaError) {
        switch (error.type) {
          case ErrorTypes.MODEL_NOT_FOUND:
            statusCode = 503;
            break;
          case ErrorTypes.CONNECTION_ERROR:
            statusCode = 503;
            break;
          case ErrorTypes.TIMEOUT:
            statusCode = 504;
            break;
          default:
            statusCode = 500;
        }
      }
    } catch (e) {
      console.error('Error determining status code:', e);
    }

    res.status(statusCode).json(errorResponse);
  } catch (e) {
    console.error('Fatal error in error handler:', e);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'An unexpected error occurred while processing the error'
    });
  }
}
