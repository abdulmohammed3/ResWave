import { Request, Response, NextFunction } from 'express';
import { createErrorResponse, logError } from '../utils/errors';
import { metricsTracker } from '../utils/metrics';
import storageEngine from '../storage';
import { UploadedFile } from './upload';

export async function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = req.body.startTime || Date.now();
  const retryCount = req.body.retryCount || 0;
  
  // Record failure in metrics
  metricsTracker.recordFailure();
  
  // Log the error
  logError(req.file?.requestId || Date.now().toString(), error, {
    path: req.path,
    method: req.method
  });
  
  // Clean up uploaded file if it exists
  const file = req.file as UploadedFile | undefined;
  if (file?.path) {
    try {
      await storageEngine.deleteFile(file.path);
      console.log(`[Request ${file.requestId}] Cleaned up file after error:`, file.path);
    } catch (cleanupError) {
      console.error(`[Request ${file.requestId}] Failed to cleanup file:`, cleanupError);
    }
  }
  
  // Generate and send error response
  const { statusCode, response } = createErrorResponse(error, startTime, retryCount);
  res.status(statusCode).json(response);
}