import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

export interface FileMetadata {
  filename: string;
  mimetype?: string;
  encoding?: string;
  size?: number;
  path?: string;
}

export interface StoredFile {
  filename: string;
  mimetype: string;
  size: number;
  uploadedAt: Date;
  path: string;
}

class Storage {
  private uploadDir: string;

  constructor(uploadDir: string) {
    this.uploadDir = uploadDir;
  }

  async initialize(): Promise<void> {
    try {
      await mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async saveFile(file: NodeJS.ReadableStream, metadata: FileMetadata): Promise<StoredFile> {
    const filename = `${Date.now()}-${metadata.filename}`;
    const filePath = path.join(this.uploadDir, filename);
    
    let fileSize = 0;
    const writeStream = fs.createWriteStream(filePath);
    
    try {
      await new Promise<void>((resolve, reject) => {
        file.on('data', (chunk) => {
          fileSize += chunk.length;
        });
        
        file.on('end', () => {
          writeStream.end();
        });

        file.on('error', (error) => {
          writeStream.destroy();
          reject(error);
        });

        writeStream.on('finish', () => {
          resolve();
        });

        writeStream.on('error', (error) => {
          reject(error);
        });

        file.pipe(writeStream);
      });
    } catch (error) {
      // Clean up the partially written file on error
      await this.deleteFile(filePath);
      throw error;
    }
    
    return {
      filename,
      mimetype: metadata.mimetype || 'application/octet-stream',
      size: metadata.size || fileSize,
      uploadedAt: new Date(),
      path: filePath
    };
  }

  async deleteFile(filepath: string): Promise<void> {
    try {
      await unlink(filepath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

// Create a singleton instance with default upload directory
const storage = new Storage(path.join(__dirname, '../uploads'));

export default storage;
