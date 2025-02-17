import { FileMetadata, StoredFile } from '../storage';

export interface VersionMetadata {
  versionNumber: number;
  changesDescription: string;
  createdAt: Date;
}

export interface CategoryMetadata {
  name: string;
  description?: string;
  parentId?: string;
}

export interface StorageMetrics {
  totalSize: number;
  fileCount: number;
  categoryCount: number;
  versionCount: number;
  lastUpdated: Date;
}

export interface FileAnalytics {
  versions: number;
  lastAccessed: Date;
  optimizationScore?: number;
  categoryPath: string[];
}

export interface EnhancedFileMetadata extends FileMetadata {
  userId: string;
  category?: string;
  tags?: string[];
  expiresAt?: Date;
  version: number;
}

export interface Version extends StoredFile {
  id: string;
  userId: string;
  versionNumber: number;
  changesDescription: string;
  parentVersionId?: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  description?: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum AlertType {
  STORAGE_LIMIT = 'STORAGE_LIMIT',
  VERSION_CREATED = 'VERSION_CREATED',
  OPTIMIZATION_COMPLETE = 'OPTIMIZATION_COMPLETE',
  FILE_EXPIRING = 'FILE_EXPIRING'
}

export interface FileEvent {
  id: string;
  fileId: string;
  userId: string;
  eventType: string;
  eventData: any;
  timestamp: Date;
}
