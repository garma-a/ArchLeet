'use client';

import { useState, useEffect } from 'react';
import { getSolutionFiles } from '@/actions/problems';
import { CodeViewer } from '@/components/editor/CodeViewer';
import type { ProblemFile } from '@/lib/types';

export function SolutionViewer({ problemId }: { problemId: string }) {
  const [files, setFiles] = useState<ProblemFile[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSolutions() {
      const data = await getSolutionFiles(problemId);
      setFiles(data as ProblemFile[] | null);
      setLoading(false);
    }
    loadSolutions();
  }, [problemId]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
        <div className="h-6 w-32 bg-gray-800 rounded mb-4"></div>
        <div className="h-[450px] bg-gray-800 rounded"></div>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-gray-400">
        No solution files available for this problem.
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-4">
        Official Solution
      </h2>
      <CodeViewer files={files} />
    </div>
  );
}
