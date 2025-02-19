'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import { FileVersion, FileData } from '@/types/files';

// Dynamically import Monaco Editor with no SSR
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] bg-gray-100 dark:bg-gray-800">
      <div className="text-gray-500 dark:text-gray-400">Loading editor...</div>
    </div>
  ),
});

interface OptimizeResponse {
  optimizedContent: string;
  metadata?: {
    retryCount?: number;
    processingTime?: number;
    chunksProcessed?: number;
    totalChunks?: number;
  };
}

interface EnhancedFileManagerProps {
  onFileSelect?: (file: FileVersion) => void;
  onOptimize?: (file: FileVersion) => Promise<OptimizeResponse | null>;
  showOptimizeButton?: boolean;
  isOptimizing?: boolean;
}

export default function EnhancedFileManager({
  onFileSelect,
  onOptimize,
  showOptimizeButton = true,
  isOptimizing = false
}: EnhancedFileManagerProps) {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<FileData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileVersion | null>(null);
  const [optimizedContent, setOptimizedContent] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper function to get authentication headers
  const getAuthHeaders = useCallback(async () => {
    const token = await getToken();
    return {
      'Authorization': `Bearer ${token}`,
    };
  }, [getToken]);

  // Fetch existing files on component mount
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/v1/files', {
          headers
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => null);
          console.error('API Error Details:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`Failed to fetch files: ${response.status} ${response.statusText}`);
        }
        
        const responseData = await response.json();
        if (!responseData.success) {
          console.error('API Response Error:', responseData);
          throw new Error(responseData.error || 'Invalid response format');
        }
        
        setFiles(responseData.data || []);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error fetching files:', {
          message: error.message,
          stack: error.stack,
          cause: error.cause
        });
        setError(`Failed to load files: ${error.message}`);
      }
    };

    fetchFiles();
  }, [getAuthHeaders, getToken]);

  const handleDownload = async (fileId: string, versionId?: string) => {
    try {
      const headers = await getAuthHeaders();
      const url = versionId 
        ? `/api/v1/files/${fileId}/versions/${versionId}/download`
        : `/api/v1/files/${fileId}/download`;
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      // Get filename from Content-Disposition header or use a default
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : 'downloaded-file';

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download error:', error);
      setError(error instanceof Error ? error.message : 'Failed to download file');
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('resume', file);
        
        const response = await fetch('/api/v1/files', {
          method: 'POST',
          headers: {
            ...headers,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.data) {
          setFiles(prev => [...prev, data.data]);
          
          // If onFileSelect is provided, call it with the newly uploaded file
          if (onFileSelect) {
            onFileSelect(data.data.versions[0]);
          }
        } else {
          throw new Error('Invalid response format');
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onFileSelect,getAuthHeaders]);

  const handleOptimize = async (version: FileVersion) => {
    if (onOptimize) {
      setIsProcessing(true);
      setSelectedFile(version);
      try {
        const result = await onOptimize(version);
        if (result?.optimizedContent) {
          setOptimizedContent(result.optimizedContent);
        }
      } catch (error) {
        console.error('Optimization error:', error);
        setError(error instanceof Error ? error.message : 'Failed to optimize resume');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Resume Manager</h2>
        
        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`
            dropzone p-8 border-2 border-dashed rounded-lg text-center cursor-pointer
            transition-colors duration-200 ease-in-out
            ${isDragActive 
              ? 'border-[#4A90A0] bg-[#A8D8EA]/10' 
              : 'border-[#A8D8EA] hover:border-[#4A90A0] hover:bg-[#A8D8EA]/5'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="space-y-4">
            <div className="text-4xl text-[#4A90A0]">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <p className="text-gray-700">
                {isDragActive
                  ? "Drop your resume here..."
                  : "Drag & drop your resume or click to select"}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Supported formats: PDF, DOCX
              </p>
            </div>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="mt-4">
            <div className="h-2 bg-[#A8D8EA]/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4A90A0] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* File List */}
      <div className="space-y-6">
        {files.map((file, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-md p-6 border border-[#A8D8EA]/20"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800">
                {file.versions[0].filename}
              </h3>
              <span className="text-sm text-gray-500">
                {file.analytics.totalVersions} versions
              </span>
            </div>

            {/* Version List */}
            <div className="space-y-3">
              {file.versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between py-2 border-b border-[#A8D8EA]/10 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Version {version.versionNumber}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(version.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleDownload(file.versions[0].id, version.id)}
                        className="text-sm text-[#4A90A0] hover:text-[#3A7A8A] transition-colors"
                        disabled={isOptimizing || isProcessing}
                      >
                        Download
                      </button>
                      {showOptimizeButton && (
                        <button
                          onClick={() => handleOptimize(version)}
                          className={`px-4 py-2 text-white rounded transition-colors ${
                            isOptimizing || isProcessing
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-[#4A90A0] hover:bg-[#3A7A8A]'
                          }`}
                          disabled={isOptimizing || isProcessing}
                        >
                          {isOptimizing ? 'Optimizing...' : isProcessing ? 'Processing...' : 'Optimize'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Optimized Content Display */}
      {optimizedContent && selectedFile && (
        <div className="mt-8 bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Optimized Resume: {selectedFile.filename}
            </h2>
          </div>
          <div className="h-[600px] w-full">
            <Editor
              defaultLanguage="markdown"
              value={optimizedContent}
              theme="vs-dark"
              options={{
                readOnly: false,
                minimap: { enabled: false },
                wordWrap: 'on',
                padding: { top: 16, bottom: 16 },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}