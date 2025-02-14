import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import {
  EnhancedFileMetadata,
  Version,
  Category,
  VersionMetadata,
  CategoryMetadata,
  StorageMetrics,
  FileAnalytics,
  FileEvent
} from '../types/storage';

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rename = promisify(fs.rename);

export class EnhancedStorageService {
  private baseDir: string;
  private versionsDir: string;
  private categoriesDir: string;
  private eventsDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.versionsDir = path.join(baseDir, 'versions');
    this.categoriesDir = path.join(baseDir, 'categories');
    this.eventsDir = path.join(baseDir, 'events');
  }

  public async initialize(): Promise<void> {
    try {
      console.log('[EnhancedStorage] Initializing storage service');
      await mkdir(this.baseDir, { recursive: true });
      await mkdir(this.versionsDir, { recursive: true });
      await mkdir(this.categoriesDir, { recursive: true });
      await mkdir(this.eventsDir, { recursive: true });
      console.log('[EnhancedStorage] Storage service initialized successfully');
    } catch (error) {
      console.error('[EnhancedStorage] Failed to initialize storage service:', error);
      throw error;
    }
  }

  public async saveFile(
    file: NodeJS.ReadableStream,
    metadata: EnhancedFileMetadata
  ): Promise<Version> {
    const fileId = uuidv4();
    const versionNumber = 1;
    const timestamp = Date.now();
    const filename = `${timestamp}-${metadata.filename}`;
    const filePath = path.join(this.baseDir, filename);
    
    try {
      // Save the file
      const writeStream = fs.createWriteStream(filePath);
      await new Promise<void>((resolve, reject) => {
        file.pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
      });

      // Create version metadata
      const version: Version = {
        id: fileId,
        filename,
        path: filePath,
        mimetype: metadata.mimetype || 'application/octet-stream',
        size: (await stat(filePath)).size,
        uploadedAt: new Date(),
        versionNumber,
        changesDescription: 'Initial version'
      };

      // Store version metadata
      await this.saveVersionMetadata(version);

      // Record event
      await this.recordEvent({
        id: uuidv4(),
        fileId,
        userId: metadata.userId,
        eventType: 'FILE_CREATED',
        eventData: {
          version: versionNumber,
          size: version.size
        },
        timestamp: new Date()
      });

      return version;
    } catch (error) {
      console.error('[EnhancedStorage] Failed to save file:', error);
      // Cleanup on failure
      await this.deleteFile(filePath).catch(console.error);
      throw error;
    }
  }

  public async createVersion(
    fileId: string,
    file: NodeJS.ReadableStream,
    metadata: VersionMetadata
  ): Promise<Version> {
    const versions = await this.listVersions(fileId);
    const versionNumber = versions.length + 1;
    const timestamp = Date.now();
    const filename = `${timestamp}-v${versionNumber}-${fileId}`;
    const filePath = path.join(this.versionsDir, filename);

    try {
      // Save the new version
      const writeStream = fs.createWriteStream(filePath);
      await new Promise<void>((resolve, reject) => {
        file.pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
      });

      const version: Version = {
        id: uuidv4(),
        filename,
        path: filePath,
        mimetype: versions[0].mimetype,
        size: (await stat(filePath)).size,
        uploadedAt: new Date(),
        versionNumber,
        changesDescription: metadata.changesDescription,
        parentVersionId: versions[versions.length - 1].id
      };

      // Store version metadata
      await this.saveVersionMetadata(version);

      return version;
    } catch (error) {
      console.error('[EnhancedStorage] Failed to create version:', error);
      await this.deleteFile(filePath).catch(console.error);
      throw error;
    }
  }

  public async listVersions(fileId: string): Promise<Version[]> {
    try {
      const versionsPath = path.join(this.versionsDir, fileId);
      const files = await readdir(versionsPath);
      const versions: Version[] = [];

      for (const file of files) {
        const versionPath = path.join(versionsPath, file);
        const versionData = JSON.parse(
          await fs.promises.readFile(versionPath, 'utf-8')
        );
        versions.push(versionData);
      }

      return versions.sort((a, b) => b.versionNumber - a.versionNumber);
    } catch (error) {
      console.error('[EnhancedStorage] Failed to list versions:', error);
      return [];
    }
  }

  public async createCategory(
    userId: string,
    metadata: CategoryMetadata
  ): Promise<Category> {
    const category: Category = {
      id: uuidv4(),
      userId,
      name: metadata.name,
      description: metadata.description,
      parentId: metadata.parentId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const categoryPath = path.join(this.categoriesDir, `${category.id}.json`);
    
    try {
      await fs.promises.writeFile(
        categoryPath,
        JSON.stringify(category, null, 2)
      );
      return category;
    } catch (error) {
      console.error('[EnhancedStorage] Failed to create category:', error);
      throw error;
    }
  }

  public async getStorageMetrics(userId: string): Promise<StorageMetrics> {
    try {
      const userFiles = await this.getUserFiles(userId);
      let totalSize = 0;
      let versionCount = 0;

      for (const file of userFiles) {
        const versions = await this.listVersions(file.id);
        totalSize += versions.reduce((sum, v) => sum + v.size, 0);
        versionCount += versions.length;
      }

      const categories = await this.getUserCategories(userId);

      return {
        totalSize,
        fileCount: userFiles.length,
        categoryCount: categories.length,
        versionCount,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('[EnhancedStorage] Failed to get storage metrics:', error);
      throw error;
    }
  }

  private async saveVersionMetadata(version: Version): Promise<void> {
    const versionDir = path.join(this.versionsDir, version.id);
    await mkdir(versionDir, { recursive: true });
    
    const metadataPath = path.join(
      versionDir,
      `v${version.versionNumber}.json`
    );

    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify(version, null, 2)
    );
  }

  private async recordEvent(event: FileEvent): Promise<void> {
    const eventPath = path.join(this.eventsDir, `${event.id}.json`);
    await fs.promises.writeFile(
      eventPath,
      JSON.stringify(event, null, 2)
    );
  }

  public async getUserFiles(userId: string): Promise<Version[]> {
    try {
      const files = await readdir(this.baseDir);
      const userFiles: Version[] = [];

      for (const file of files) {
        const filePath = path.join(this.baseDir, file);
        const stats = await stat(filePath);
        if (stats.isFile()) {
          const version = JSON.parse(
            await fs.promises.readFile(filePath, 'utf-8')
          );
          if (version.userId === userId) {
            userFiles.push(version);
          }
        }
      }

      return userFiles;
    } catch (error) {
      console.error('[EnhancedStorage] Failed to get user files:', error);
      return [];
    }
  }

  private async getUserCategories(userId: string): Promise<Category[]> {
    try {
      const files = await readdir(this.categoriesDir);
      const userCategories: Category[] = [];

      for (const file of files) {
        const categoryPath = path.join(this.categoriesDir, file);
        const category = JSON.parse(
          await fs.promises.readFile(categoryPath, 'utf-8')
        );
        if (category.userId === userId) {
          userCategories.push(category);
        }
      }

      return userCategories;
    } catch (error) {
      console.error('[EnhancedStorage] Failed to get user categories:', error);
      return [];
    }
  }

  private async deleteFile(filepath: string): Promise<void> {
    try {
      await unlink(filepath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

// Create a singleton instance
const storage = new EnhancedStorageService(
  path.join(__dirname, '../../storage')
);

export default storage;