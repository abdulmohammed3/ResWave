import { UploadedFile } from '../middleware/upload';

declare global {
  namespace Express {
    interface Request {
      file?: UploadedFile;
    }
  }
}