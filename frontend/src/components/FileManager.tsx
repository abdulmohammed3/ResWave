'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileVersion {
  id: string;
  filename: string;
  versionNumber: number;
  changesDescription: string;
  uploadedAt: Date;
  size: number;
}

interface FileData {
  versions: FileVersion[];
  analytics: {
    totalVersions: number;
    lastAccessed: Date;
  };
}

export default function FileManager() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing files on component mount
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        // Get the API URL from environment or use default
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_URL}/api/v1/files`);
        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }
        const data = await response.json();
        if (data.success) {
          setFiles(data.data);
        }
      } catch (error) {
        console.error('Error fetching files:', error);
        setError('Failed to load existing files');
      }
    };

    fetchFiles();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('resume', file);
        
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_URL}/api/v1/files`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        if (data.success && data.data) {
          setFiles(prev => [...prev, data.data]);
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
  }, []);

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
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">File Manager</h2>
        
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
                  ? "Drop your files here..."
                  : "Drag & drop files here or click to select"}
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
                    <button className="text-sm text-[#4A90A0] hover:text-[#3A7A8A] transition-colors">
                      Download
                    </button>
                    <button className="text-sm text-[#4A90A0] hover:text-[#3A7A8A] transition-colors">
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}