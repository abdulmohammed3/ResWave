import { Express } from 'express-serve-static-core';
import { Multer } from 'multer';

declare module 'express-serve-static-core' {
  interface Request {
    file?: Express.Multer.File & {
      requestId?: string;
    };
  }
}

declare module 'multer' {
  namespace Multer {
    interface File {
      requestId?: string;
    }
  }
}

export {};