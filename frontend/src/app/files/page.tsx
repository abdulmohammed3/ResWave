'use client';

import FileManager from '@/components/FileManager';

export default function FilesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">
        Resume Manager
      </h1>
      <FileManager />
    </div>
  );
}