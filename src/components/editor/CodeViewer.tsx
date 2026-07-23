'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ProblemFile } from '@/lib/types';

// Lazy-load Monaco to avoid SSR issues
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  { ssr: false, loading: () => <div className="h-64 bg-gray-900 animate-pulse rounded" /> }
);

interface CodeViewerProps {
  files: Pick<ProblemFile, 'filename' | 'language' | 'content'>[];
}

export function CodeViewer({ files }: CodeViewerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const activeFile = files[activeTab];

  if (!files || files.length === 0) {
    return <div className="p-4 text-gray-500">No files available.</div>;
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden flex flex-col">
      {/* File tabs */}
      <div className="flex bg-gray-800 border-b border-gray-700 overflow-x-auto">
        {files.map((file, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`px-4 py-2 text-sm font-mono whitespace-nowrap transition-colors ${
              idx === activeTab
                ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-750'
            }`}
          >
            {file.filename}
          </button>
        ))}
      </div>

      {/* Monaco editor — read-only */}
      <div className="h-[450px]">
        <MonacoEditor
          language={activeFile?.language || 'typescript'}
          value={activeFile?.content || ''}
          theme="vs-dark"
          options={{
            readOnly:          true,
            minimap:           { enabled: false },
            fontSize:          13,
            lineNumbers:       'on',
            scrollBeyondLastLine: false,
            wordWrap:          'on',
            renderLineHighlight: 'none',
            contextmenu:       false,
            folding:           true,
            automaticLayout:   true,
          }}
        />
      </div>
    </div>
  );
}
