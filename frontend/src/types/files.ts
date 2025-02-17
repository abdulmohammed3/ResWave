export interface FileVersion {
  id: string;
  filename: string;
  versionNumber: number;
  changesDescription: string;
  uploadedAt: Date;
  size: number;
}

export interface FileData {
  versions: FileVersion[];
  analytics: {
    totalVersions: number;
    lastAccessed: Date;
  };
}