'use client';

import { useEffect, useState, useCallback } from 'react';

type Status = 'pending' | 'processing' | 'completed' | 'failed';

interface SubmissionResult {
  status:      Status;
  is_correct:  boolean | null;
  ai_score:    number | null;
  ai_feedback: string | null;
}

interface SubmissionStatusProps {
  submissionId: string;
  onComplete:   (result: SubmissionResult) => void;
}

const POLL_INTERVAL = 3000; // 3 seconds

export function SubmissionStatus({ submissionId, onComplete }: SubmissionStatusProps) {
  const [dots, setDots] = useState('');

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res  = await fetch(`/api/submission-status/${submissionId}`);
      const data = await res.json() as SubmissionResult;

      if (data.status === 'completed' || data.status === 'failed') {
        onComplete(data);
        return false; // Stop polling
      }
      return true; // Keep polling
    } catch {
      return true; // Keep polling on network error
    }
  }, [submissionId, onComplete]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    async function doPoll() {
      const shouldContinue = await poll();
      if (shouldContinue) {
        timeoutId = setTimeout(doPoll, POLL_INTERVAL);
      }
    }

    doPoll();
    return () => clearTimeout(timeoutId);
  }, [poll]);

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">
        Evaluating your solution{dots}
      </p>
      <p className="text-gray-600 text-xs">
        This usually takes 10–30 seconds
      </p>
    </div>
  );
}
