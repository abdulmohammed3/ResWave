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
      
      // Create base directories
      await mkdir(this.baseDir, { recursive: true });
      await mkdir(this.versionsDir, { recursive: true });
      await mkdir(this.categoriesDir, { recursive: true });
      await mkdir(this.eventsDir, { recursive: true });

      // Validate and fix storage directory structure
      const dirs = await readdir(this.versionsDir);
      for (const dir of dirs) {
        const fullPath = path.join(this.versionsDir, dir);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          try {
            const files = await readdir(fullPath);
            const hasVersionFiles = files.some(f => f.endsWith('.json'));
            
            if (!hasVersionFiles) {
              console.warn(`[EnhancedStorage] Empty version directory found: ${dir}, cleaning up`);
              await fs.promises.rmdir(fullPath);
            }
          } catch (err) {
            console.error(`[EnhancedStorage] Error validating directory ${dir}:`, err);
          }
        } else {
          console.warn(`[EnhancedStorage] Non-directory item found in versions: ${dir}, cleaning up`);
          await unlink(fullPath);
        }
      }

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
        userId: metadata.userId,
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
        userId: versions[0].userId, // Use the same userId as the parent version
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
      
      // Check if directory exists
      try {
        await fs.promises.access(versionsPath);
      } catch {
        console.warn(`[EnhancedStorage] Version directory not found for file ${fileId}`);
        return [];
      }

      // Read all files in the version directory
      const files = await readdir(versionsPath);
      const versionFiles = files.filter(f => f.endsWith('.json'));
      
      if (versionFiles.length === 0) {
        console.warn(`[EnhancedStorage] No version files found for file ${fileId}`);
        return [];
      }

      const versions: Version[] = [];
      for (const file of versionFiles) {
        try {
          const versionPath = path.join(versionsPath, file);
          const content = await fs.promises.readFile(versionPath, 'utf-8');
          const versionData = JSON.parse(content);
          
          // Validate version data
          if (!versionData.id || !versionData.filename || !versionData.versionNumber) {
            console.warn(`[EnhancedStorage] Invalid version data in ${file}`);
            continue;
          }
          
          versions.push(versionData);
        } catch (err) {
          console.error(`[EnhancedStorage] Error reading version file ${file}:`, err);
          continue;
        }
      }

      // Sort versions by number in descending order
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
      if (!userId) {
        console.error('[EnhancedStorage] User ID is required');
        return [];
      }

      const versionDirs = await readdir(this.versionsDir);
      const userFiles: Version[] = [];

      for (const versionDir of versionDirs) {
        try {
          // Skip non-directory items and hidden files
          if (versionDir.startsWith('.')) continue;
          
          const versionPath = path.join(this.versionsDir, versionDir);
          const stats = await stat(versionPath);
          
          if (!stats.isDirectory()) continue;

          // Get all version files
          const allVersions = await this.listVersions(versionDir);
          
          // Find the latest version that belongs to this user
          const latestVersion = allVersions.find(v => v.userId === userId);
          
          if (latestVersion) {
            userFiles.push(latestVersion);
          }
        } catch (err) {
          console.error(`[EnhancedStorage] Error processing version directory ${versionDir}:`, err);
          // Continue with next directory
          continue;
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

  public async checkHealth(): Promise<boolean> {
    try {
      // Verify all required directories exist and are accessible
      await Promise.all([
        mkdir(this.baseDir, { recursive: true }),
        mkdir(this.versionsDir, { recursive: true }),
        mkdir(this.categoriesDir, { recursive: true }),
        mkdir(this.eventsDir, { recursive: true })
      ]);
      
      // Check if we can write and read a test file
      const testFile = path.join(this.baseDir, '.health-check');
      await fs.promises.writeFile(testFile, 'health check');
      await fs.promises.readFile(testFile);
      await unlink(testFile);
      
      return true;
    } catch (error) {
      console.error('[EnhancedStorage] Health check failed:', error);
      return false;
    }
  }
}

// Create a singleton instance
const storage = new EnhancedStorageService(
  path.join(__dirname, '../../storage')
);

export default storage;
