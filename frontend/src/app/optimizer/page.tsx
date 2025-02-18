'use client';

import { useState } from 'react';
import EnhancedFileManager from '@/components/EnhancedFileManager';
import { FileVersion } from '@/types/files';

interface OptimizeResponse {
  optimizedContent: string;
  metadata?: {
    retryCount?: number;
    processingTime?: number;
    chunksProcessed?: number;
    totalChunks?: number;
  };
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

export default function OptimizerPage() {
  const [error, setError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const optimizeWithRetry = async (
    fileId: string,
    retryCount: number = 0
  ): Promise<OptimizeResponse> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout
      
      const response = await fetch(`/api/v1/files/${fileId}/optimize`, {
        method: 'POST',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const { success, data } = await response.json();
      if (!success) {
        throw new Error('Failed to optimize resume');
      }
      return data;
    } catch (error) {
      if (retryCount >= MAX_RETRIES) {
        throw new Error(
          `Failed after ${MAX_RETRIES} attempts. ${error instanceof Error ? error.message : String(error)}`
        );
      }

      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));

      return optimizeWithRetry(fileId, retryCount + 1);
    }
  };

  const handleOptimize = async (fileVersion: FileVersion) => {
    setIsOptimizing(true);
    setError(null);

    try {
      const optimizeData = await optimizeWithRetry(fileVersion.id);
      return optimizeData;
    } catch (error) {
      console.error('Error optimizing resume:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      return null;
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
   <div className="container mx-auto px-4 py-8">
     <div className="max-w-4xl mx-auto">
       <h1 className="text-3xl font-bold mb-8 text-gray-800">Resume Optimizer</h1>
       
       {isOptimizing && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white p-6 rounded-lg shadow-lg">
             <div className="flex items-center space-x-4">
               <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
               <p className="text-lg text-gray-700">Optimizing your resume...</p>
             </div>
           </div>
         </div>
       )}

       <EnhancedFileManager
         onOptimize={handleOptimize}
         showOptimizeButton={true}
         isOptimizing={isOptimizing}
       />

       {error && (
         <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-lg">
           {error}
         </div>
       )}
     </div>
   </div>
  );
}
