'use client';

import ReactMarkdown from 'react-markdown';

interface SubmissionResultProps {
  isCorrect:   boolean;
  score:       number;
  feedback:    string;
  onRetry:     () => void;
  onViewSolution: () => void;
}

export function SubmissionResult({
  isCorrect, score, feedback, onRetry, onViewSolution
}: SubmissionResultProps) {
  return (
    <div className={`rounded-xl border-2 p-6 space-y-4 ${
      isCorrect
        ? 'border-green-500 bg-green-950/30'
        : 'border-gray-600 bg-gray-900/50'
    }`}>
      {/* Score header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`text-3xl ${isCorrect ? '' : ''}`}>
            {isCorrect ? '✅' : '❌'}
          </div>
          <div>
            <p className={`text-lg font-semibold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {isCorrect ? 'Correct!' : 'Not quite right'}
            </p>
            <p className="text-gray-400 text-sm">
              Score: <span className={`font-mono font-bold ${
                score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'
              }`}>{score}/100</span>
            </p>
          </div>
        </div>

        {/* Score circle */}
        <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center font-bold text-lg ${
          score >= 70 ? 'border-green-500 text-green-400'
          : score >= 40 ? 'border-yellow-500 text-yellow-400'
          : 'border-red-500 text-red-400'
        }`}>
          {score}
        </div>
      </div>

      {/* AI Feedback */}
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown>{feedback}</ReactMarkdown>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        {!isCorrect && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm
                       font-medium rounded-lg transition-colors"
          >
            Try Again
          </button>
        )}
        <button
          onClick={onViewSolution}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm
                     font-medium rounded-lg transition-colors"
        >
          {isCorrect ? 'View Official Solution' : 'Give Up & See Solution'}
        </button>
      </div>
    </div>
  );
}
