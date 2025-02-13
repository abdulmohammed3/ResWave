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

  getUploadPath(): string {
    return this.uploadDir;
  }

  async initialize(): Promise<void> {
    try {
      console.log(`[Storage] Initializing storage at ${this.uploadDir}`);
      await mkdir(this.uploadDir, { recursive: true });
      console.log(`[Storage] Storage initialized successfully`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        console.error(`[Storage] Failed to initialize storage:`, error);
        throw error;
      }
      console.log(`[Storage] Upload directory already exists`);
    }
  }

  async saveFile(file: NodeJS.ReadableStream, metadata: FileMetadata): Promise<StoredFile> {
    console.log(`[Storage] Starting file save:`, {
      filename: metadata.filename,
      mimetype: metadata.mimetype
    });

    const filename = `${Date.now()}-${metadata.filename}`;
    const filePath = path.join(this.uploadDir, filename);
    
    let fileSize = 0;
    const writeStream = fs.createWriteStream(filePath);
    
    try {
      await new Promise<void>((resolve, reject) => {
        file.on('data', (chunk) => {
          fileSize += chunk.length;
          console.log(`[Storage] Received chunk of size ${chunk.length}, total: ${fileSize}`);
        });
        
        file.on('end', () => {
          console.log(`[Storage] File stream ended, total size: ${fileSize}`);
          writeStream.end();
        });

        file.on('error', (error) => {
          console.error(`[Storage] File stream error:`, error);
          writeStream.destroy();
          reject(error);
        });

        writeStream.on('finish', () => {
          console.log(`[Storage] Write stream finished successfully`);
          resolve();
        });

        writeStream.on('error', (error) => {
          console.error(`[Storage] Write stream error:`, error);
          reject(error);
        });

        file.pipe(writeStream);
      });

      // Verify the file was written correctly
      const stats = await fs.promises.stat(filePath);
      console.log(`[Storage] File saved successfully:`, {
        path: filePath,
        size: stats.size,
        expectedSize: fileSize
      });

      if (stats.size !== fileSize) {
        throw new Error(`File size mismatch: expected ${fileSize}, got ${stats.size}`);
      }
    } catch (error) {
      console.error(`[Storage] Error saving file:`, error);
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
      console.log(`[Storage] Attempting to delete file:`, filepath);
      await unlink(filepath);
      console.log(`[Storage] File deleted successfully:`, filepath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[Storage] Error deleting file:`, error);
        throw error;
      }
      console.log(`[Storage] File already deleted or doesn't exist:`, filepath);
    }
  }
}

// Create a singleton instance with default upload directory
const storage = new Storage(path.join(__dirname, '../uploads'));

export default storage;
