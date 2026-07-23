'use client';

import { useState, useTransition } from 'react';
import { submitAnswer } from '@/actions/submissions';

interface SubmissionFormProps {
  problemId:   string;
  onSubmitted: (submissionId: string) => void;
  disabled?:   boolean;
}

export function SubmissionForm({ problemId, onSubmitted, disabled }: SubmissionFormProps) {
  const [answer, setAnswer]     = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const charCount = answer.trim().length;
  const MIN_CHARS = 20;

  function handleSubmit() {
    setError(null);
    if (charCount < MIN_CHARS) {
      setError(`Answer must be at least ${MIN_CHARS} characters.`);
      return;
    }

    startTransition(async () => {
      const result = await submitAnswer(problemId, answer);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSubmitted(result.data.submissionId);
    });
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">
        Your Solution
        <span className="ml-2 text-xs text-gray-500 font-normal">
          Explain the problem, name the pattern, describe the fix. Any format is fine.
        </span>
      </label>

      <textarea
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        disabled={disabled || isPending}
        placeholder="Example: The PaymentService violates the Open/Closed Principle because new payment methods require modifying the existing class. The fix is to extract an IPaymentProcessor interface and implement a Strategy Pattern..."
        className="w-full h-48 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg
                   text-gray-100 text-sm font-mono resize-y
                   focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />

      <div className="flex items-center justify-between">
        <span className={`text-xs ${charCount < MIN_CHARS ? 'text-gray-500' : 'text-green-500'}`}>
          {charCount} characters {charCount < MIN_CHARS ? `(min ${MIN_CHARS})` : '✓'}
        </span>

        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}

        <button
          onClick={handleSubmit}
          disabled={disabled || isPending || charCount < MIN_CHARS}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600
                     text-white text-sm font-medium rounded-lg transition-colors
                     disabled:cursor-not-allowed"
        >
          {isPending ? 'Submitting…' : 'Submit Solution'}
        </button>
      </div>
    </div>
  );
}
