import { Version } from './storage';

declare global {
  namespace Express {
    // Extend the Express Request type
    interface Request {
      file?: Multer.File & {
        requestId?: string;
        version?: Version;
      };
    }

    // Extend the Multer File interface
    namespace Multer {
      interface File {
        requestId?: string;
        version?: Version;
      }
    }
  }
}

export {};