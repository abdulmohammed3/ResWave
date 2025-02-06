'use client';

import { useState } from 'react';
import { useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import dynamic from 'next/dynamic';

// Dynamically import Monaco Editor with no SSR
const Editor = dynamic(() => import('@monaco-editor/react'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] bg-gray-100 dark:bg-gray-800">
      <div className="text-gray-500 dark:text-gray-400">Loading editor...</div>
    </div>
  ),
});

type AcceptedFile = File & { path?: string };

export default function OptimizerPage() {
  const [optimizedContent, setOptimizedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onDrop = useMemo(() => async (acceptedFiles: AcceptedFile[]) => {
    if (acceptedFiles.length === 0) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('resume', acceptedFiles[0]);

    try {
      const response = await fetch('http://localhost:3001/api/optimize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: { optimizedContent: string } = await response.json();
      setOptimizedContent(data.optimizedContent);
    } catch (error) {
      console.error('Error optimizing resume:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    onDrop
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">Resume Optimizer</h1>
        
        <div className="mb-8">
          <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-colors">
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="flex justify-center">
                <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-300">Drag & drop your resume here, or click to select file</p>
              <p className="text-sm text-gray-500">Only .docx files are supported</p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-blue-600 transition ease-in-out duration-150 cursor-not-allowed">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Optimizing your resume...
            </div>
          </div>
        )}

        {optimizedContent && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Optimized Resume</h2>
            </div>
            <div className="h-[600px] w-full">
              {/* @ts-ignore */}
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
    </div>
  );
}
