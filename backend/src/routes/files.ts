import express from 'express';
import { storage, ollama } from '../services';
import * as fs from 'fs/promises';
import { uploadMiddleware } from '../middleware/upload';
import { OptimizationError } from '../utils/errors';
import { Version } from '../types/storage';

const router = express.Router();

/**
 * Get all files with their versions and analytics
 * GET /api/v1/files
 */
router.get('/', async (req, res, next) => {
  try {
    // Temporarily using a mock userId until auth is implemented
    const userId = req.query.userId || 'default-user';
    const userFiles = await storage.getUserFiles(userId as string);
    
    // Transform the data to match the FileData interface expected by the frontend
    const files = await Promise.all(userFiles.map(async (file) => {
      const versions = await storage.listVersions(file.id);
      return {
        versions,
        analytics: {
          totalVersions: versions.length,
          lastAccessed: new Date()
        }
      };
    }));

    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    next(new OptimizationError('Failed to fetch files', {
      stage: 'file_fetch',
      processingStatus: 'fetch_failed',
      timestamp: new Date().toISOString(),
      error
    }));
  }
});

/**
 * Upload a new file or create a new version
 * POST /api/v1/files
 */
router.post('/', uploadMiddleware, async (req, res, next) => {
  try {
    const version: Version = req.file?.version as Version;
    
    if (!version) {
      throw new Error('No version data received from upload');
    }

    // Format the response to match the FileData structure expected by frontend
    const fileData = {
      versions: [{
        id: version.id,
        filename: version.filename,
        versionNumber: version.versionNumber,
        changesDescription: version.changesDescription || 'Initial version',
        uploadedAt: version.uploadedAt,
        size: version.size
      }],
      analytics: {
        totalVersions: 1,
        lastAccessed: new Date()
      }
    };

    res.json({
      success: true,
      data: fileData
    });
  } catch (error) {
    next(new OptimizationError('Failed to process upload', {
      stage: 'file_upload',
      processingStatus: 'upload_failed',
      timestamp: new Date().toISOString(),
      error
    }));
  }
});

/**
 * Get file versions
 * GET /api/v1/files/:fileId/versions
 */
router.get('/:fileId/versions', async (req, res, next) => {
  try {
    const versions = await storage.listVersions(req.params.fileId);
    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    next(new OptimizationError('Failed to fetch versions', {
      stage: 'version_fetch',
      processingStatus: 'fetch_failed',
      timestamp: new Date().toISOString(),
      error
    }));
  }
});

/**
 * Restore a specific version
 * POST /api/v1/files/:fileId/versions/:versionId/restore
 */
router.post('/:fileId/versions/:versionId/restore', async (req, res, next) => {
  try {
    const versions = await storage.listVersions(req.params.fileId);
    const versionToRestore = versions.find(v => v.id === req.params.versionId);

    if (!versionToRestore) {
      return next(new OptimizationError('Version not found', {
        stage: 'version_restore',
        processingStatus: 'version_not_found',
        timestamp: new Date().toISOString()
      }));
    }

    // Create a new version from the restored version
    const restoredVersion = await storage.createVersion(
      req.params.fileId,
      // Read the file content from the version to restore
      require('fs').createReadStream(versionToRestore.path),
      {
        versionNumber: 0, // Will be calculated by storage service
        changesDescription: `Restored from version ${versionToRestore.versionNumber}`,
        createdAt: new Date()
      }
    );

    res.json({
      success: true,
      data: restoredVersion
    });
  } catch (error) {
    next(new OptimizationError('Failed to restore version', {
      stage: 'version_restore',
      processingStatus: 'restore_failed',
      timestamp: new Date().toISOString(),
      error
    }));
  }
});

/**
 * Download a file
 * GET /api/v1/files/:fileId/download
 */
router.get('/:fileId/download', async (req, res, next) => {
  try {
    const versions = await storage.listVersions(req.params.fileId);
    if (versions.length === 0) {
      throw new Error('No versions found for this file');
    }

    const latestVersion = versions[0];
    res.download(latestVersion.path, latestVersion.filename);
  } catch (error) {
    next(new OptimizationError('Failed to download file', {
      stage: 'file_download',
      processingStatus: 'download_failed',
      timestamp: new Date().toISOString(),
      error
    }));
  }
});

/**
 * Download a specific version of a file
 * GET /api/v1/files/:fileId/versions/:versionId/download
 */
router.get('/:fileId/versions/:versionId/download', async (req, res, next) => {
  try {
    const versions = await storage.listVersions(req.params.fileId);
    const version = versions.find(v => v.id === req.params.versionId);
    
    if (!version) {
      throw new Error('Version not found');
    }

    res.download(version.path, version.filename);
  } catch (error) {
    next(new OptimizationError('Failed to download version', {
      stage: 'version_download',
      processingStatus: 'download_failed',
      timestamp: new Date().toISOString(),
      error
    }));
  }
});

/**
 * Get file analytics
 * GET /api/v1/files/:fileId/analytics
 */
router.get('/:fileId/analytics', async (req, res, next) => {
  try {
    const versions = await storage.listVersions(req.params.fileId);
    const analytics = {
      versions: versions.length,
      lastAccessed: new Date(),
      categoryPath: [], // To be implemented with categories
      latestVersion: versions[0]
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    next(new OptimizationError('Failed to fetch analytics', {
      stage: 'analytics_fetch',
      processingStatus: 'fetch_failed',
      timestamp: new Date().toISOString(),
      error
    }));
  }
});

/**
 * Optimize a specific version of a file
 * POST /api/v1/files/:fileId/optimize
 */
router.post('/:fileId/optimize', async (req, res, next) => {
  try {
    const versions = await storage.listVersions(req.params.fileId);
    if (versions.length === 0) {
      throw new Error('No versions found for this file');
    }

    const latestVersion = versions[0];
    const fileContent = await fs.readFile(latestVersion.path, 'utf-8');
    
    // Process the content with Ollama
    const optimizedContent = await ollama.optimizeResume(fileContent);

    // Return the optimized content and metadata
    res.json({
      success: true,
      data: {
        optimizedContent,
        metadata: {
          processingTime: Date.now() - new Date(req.headers['x-request-time'] as string).getTime() || 0,
          chunksProcessed: 1,
          totalChunks: 1
        }
      }
    });
  } catch (error) {
    next(new OptimizationError('Failed to optimize file', {
      stage: 'file_optimization',
      processingStatus: 'optimization_failed',
      timestamp: new Date().toISOString(),
      error
    }));
  }
});

export default router;