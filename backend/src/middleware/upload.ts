import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { OptimizationError } from '../utils/errors';
import { isValidFileType } from '../utils/content';
import storage from '../storage';

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

// Custom storage engine using our storage module
const storageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, storage.getUploadPath());
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.originalname}`;
    cb(null, filename);
  }
});

// Configure multer
const upload = multer({
  storage: storageEngine,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow one file at a time
  }
});

// Middleware to handle file uploads
export const uploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const singleUpload = upload.single('resume');

  singleUpload(req, res, (error: any) => {
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

    if (!req.file) {
      return next(new OptimizationError('No file uploaded', {
        stage: 'file_upload',
        processingStatus: 'no_file',
        timestamp: new Date().toISOString()
      }));
    }

    // Add request ID for tracking
    req.file.requestId = Date.now().toString();
    
    next();
  });
};