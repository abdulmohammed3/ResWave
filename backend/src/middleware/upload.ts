import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { OptimizationError } from '../utils/errors';
import { isValidFileType } from '../utils/content';
import { storage } from '../services';
import { EnhancedFileMetadata, Version } from '../types/storage';

// Custom file filter
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  console.log(`[Request ${Date.now()}] Receiving file:`, {
    fieldname: file.fieldname,
    filename: file.originalname,
    encoding: file.encoding,
    mimeType: file.mimetype
  });

  if (!file.originalname || !file.mimetype) {
    return cb(new OptimizationError('Invalid file upload', {
      stage: 'file_validation',
      processingStatus: 'invalid_file',
      timestamp: new Date().toISOString()
    }));
  }

  if (!isValidFileType(file.mimetype, file.originalname)) {
    return cb(new OptimizationError('Invalid file type', {
      stage: 'file_validation',
      processingStatus: 'invalid_type',
      timestamp: new Date().toISOString()
    }));
  }

  cb(null, true);
};

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage to handle file data in the middleware
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow one file at a time
  }
});

// Interface for request with file and version info
interface VersionedUploadRequest extends Request {
  file: Express.Multer.File;
  body: {
    userId: string;
    fileId?: string; // Present for version updates
    category?: string;
    tags?: string[];
    changesDescription?: string;
  };
}

// Middleware to handle file uploads
export const uploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const singleUpload = upload.single('resume');

  singleUpload(req, res, async (error: any) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new OptimizationError('File too large', {
          stage: 'file_upload',
          processingStatus: 'file_too_large',
          timestamp: new Date().toISOString()
        }));
      }
      
      if (error.code === 'LIMIT_FILE_COUNT') {
        return next(new OptimizationError('Too many files', {
          stage: 'file_upload',
          processingStatus: 'too_many_files',
          timestamp: new Date().toISOString()
        }));
      }

      return next(new OptimizationError(`Upload error: ${error.message}`, {
        stage: 'file_upload',
        processingStatus: 'upload_failed',
        timestamp: new Date().toISOString()
      }));
    }

    if (error) {
      return next(error);
    }

    const versionedReq = req as VersionedUploadRequest;

    if (!versionedReq.file) {
      return next(new OptimizationError('No file uploaded', {
        stage: 'file_upload',
        processingStatus: 'no_file',
        timestamp: new Date().toISOString()
      }));
    }

    try {
      let savedVersion: Version;

      if (versionedReq.body.fileId) {
        // This is a version update
        savedVersion = await storage.createVersion(
          versionedReq.body.fileId,
          bufferToStream(versionedReq.file.buffer),
          {
            versionNumber: 0, // Will be calculated by the storage service
            changesDescription: versionedReq.body.changesDescription || 'Updated version',
            createdAt: new Date()
          }
        );
      } else {
        // This is a new file
        const metadata: EnhancedFileMetadata = {
          filename: versionedReq.file.originalname,
          mimetype: versionedReq.file.mimetype,
          encoding: versionedReq.file.encoding,
          size: versionedReq.file.size,
          userId: versionedReq.body.userId,
          category: versionedReq.body.category,
          tags: versionedReq.body.tags,
          version: 1
        };

        savedVersion = await storage.saveFile(
          bufferToStream(versionedReq.file.buffer),
          metadata
        );
      }

      // Add version info to the request for subsequent middleware
      versionedReq.file.version = savedVersion;
      next();
    } catch (err) {
      next(new OptimizationError('Failed to save file', {
        stage: 'file_storage',
        processingStatus: 'storage_failed',
        timestamp: new Date().toISOString(),
        error: err
      }));
    }
  });
};

// Helper function to convert Buffer to Readable Stream
function bufferToStream(buffer: Buffer): NodeJS.ReadableStream {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}