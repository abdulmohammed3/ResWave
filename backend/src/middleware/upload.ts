import { Request, Response, NextFunction } from 'express';
import busboy from 'busboy';
import { FileMetadata } from '../storage';
import storageEngine from '../storage';
import { FILE, TIMEOUTS } from '../config';
import { OptimizationError } from '../utils/errors';
import { isValidFileType } from '../utils/content';

export interface UploadedFile extends FileMetadata {
  requestId: string;
}

export async function handleFileUpload(
  req: Request,
  requestId: string
): Promise<UploadedFile> {
  // Validate content type
  const contentType = req.headers['content-type'];
  if (!contentType?.includes('multipart/form-data')) {
    throw new OptimizationError('Content-Type must be multipart/form-data', {
      stage: 'content_type_validation',
      processingStatus: 'invalid_content_type',
      timestamp: new Date().toISOString()
    });
  }

  return new Promise((resolve, reject) => {
    let hasFile = false;
    let fileMetadata: FileMetadata | undefined;
    let fileStreamEnded = false;
    let fileStreamPromise: Promise<void>;

    const bb = busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: FILE.MAX_SIZE
      }
    });

    bb.on('file', async (fieldname, file, info) => {
      console.log(`[Request ${requestId}] Receiving file:`, {
        fieldname,
        filename: info.filename,
        encoding: info.encoding,
        mimeType: info.mimeType
      });

      // Set up file stream completion promise
      fileStreamPromise = new Promise<void>((resolveStream, rejectStream) => {
        file.on('end', () => {
          fileStreamEnded = true;
          resolveStream();
        });
        file.on('error', (error) => {
          console.error(`[Request ${requestId}] File stream error:`, error);
          rejectStream(error);
        });
      });

      try {
        hasFile = true;
        
        if (!isValidFileType(info.mimeType, info.filename)) {
          throw new OptimizationError('Invalid file type. Only DOCX and TXT files are allowed.', {
            stage: 'file_validation',
            hasFile: true,
            fileReceived: true,
            processingStatus: 'failed_validation',
            timestamp: new Date().toISOString()
          });
        }

        // Use Promise.race to apply timeout to file upload
        fileMetadata = await Promise.race([
          storageEngine.saveFile(file, {
            filename: info.filename,
            mimetype: info.mimeType
          }),
          new Promise<never>((_, rejectTimeout) => {
            setTimeout(() => rejectTimeout(new Error('File upload timed out')), TIMEOUTS.UPLOAD);
          })
        ]);

        // Wait for the file stream to complete
        await fileStreamPromise;
        
        if (!fileStreamEnded) {
          throw new OptimizationError('File stream ended prematurely', {
            stage: 'file_upload',
            hasFile: true,
            fileReceived: true,
            processingStatus: 'stream_incomplete',
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        // Clean up partial file if it exists
        if (fileMetadata?.path) {
          try {
            await storageEngine.deleteFile(fileMetadata.path);
          } catch (cleanupError) {
            console.error(`[Request ${requestId}] Failed to cleanup partial file:`, cleanupError);
          }
        }
        reject(error);
      }
    });

    bb.on('finish', () => {
      try {
        if (!hasFile) {
          throw new OptimizationError('No file was uploaded in the request', {
            stage: 'file_validation',
            hasFile: false,
            processingStatus: 'no_file',
            timestamp: new Date().toISOString()
          });
        }

        if (!fileMetadata || !fileMetadata.path || !fileMetadata.filename) {
          throw new OptimizationError('File upload stream completed but processing failed', {
            stage: 'file_processing',
            hasFile: true,
            fileReceived: true,
            processingStatus: 'incomplete_metadata',
            timestamp: new Date().toISOString()
          });
        }

        resolve({
          ...fileMetadata,
          requestId
        });
      } catch (error) {
        reject(error);
      }
    });

    bb.on('error', reject);
    req.pipe(bb);
  });
}

export const uploadMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = Date.now().toString();
  
  try {
    const file = await handleFileUpload(req, requestId);
    req.file = file;
    next();
  } catch (error) {
    if (error instanceof OptimizationError) {
      res.status(422).json({
        error: error.message,
        context: error.context
      });
      return;
    }
    next(error);
  }
};