'use client';

import { useState } from 'react';
import { CodeViewer } from '@/components/editor/CodeViewer';
import { SubmissionForm } from '@/components/submission/SubmissionForm';
import { SubmissionStatus } from '@/components/submission/SubmissionStatus';
import { SubmissionResult } from '@/components/submission/SubmissionResult';
import { SolutionViewer } from '@/components/solution/SolutionViewer';
import { DifficultyBadge } from '@/components/problems/DifficultyBadge';
import { giveUp } from '@/actions/submissions';
import type { ProblemWithFiles, Submission } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type PageState = 'idle' | 'polling' | 'result' | 'solution';

interface Result {
  is_correct:  boolean;
  ai_score:    number;
  ai_feedback: string;
}

interface Props {
  problem:           ProblemWithFiles;
  submissionHistory: Submission[];
}

export function ProblemDetailClient({ problem, submissionHistory }: Props) {
  const [pageState,     setPageState]     = useState<PageState>('idle');
  const [submissionId,  setSubmissionId]  = useState<string | null>(null);
  const [result,        setResult]        = useState<Result | null>(null);
  const [showHint,      setShowHint]      = useState(false);
  const [hintIndex,     setHintIndex]     = useState(0);

  const alreadySolved = submissionHistory.some(s => s.is_correct);

  function handleSubmitted(id: string) {
    setSubmissionId(id);
    setPageState('polling');
  }

  function handlePollingComplete(data: any) {
    if (data.status === 'failed') {
      setResult({
        is_correct:  false,
        ai_score:    0,
        ai_feedback: 'Our evaluator encountered an error. Please resubmit.',
      });
    } else {
      setResult({
        is_correct:  data.is_correct,
        ai_score:    data.ai_score,
        ai_feedback: data.ai_feedback,
      });
      if (data.is_correct) {
        // Auto-refresh to update solved status
        setTimeout(() => window.location.reload(), 3000);
      }
    }
    setPageState('result');
  }

  async function handleGiveUp() {
    await giveUp(problem.id);
    setPageState('solution');
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Problem header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <DifficultyBadge difficulty={problem.difficulty} />
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              {problem.category.replace(/_/g, ' ')}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">{problem.title}</h1>
          {problem.tags.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {problem.tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LEFT: Problem description + code files */}
          <div className="space-y-6">
            {/* Description */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Problem
              </h2>
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description}</ReactMarkdown>
              </div>
            </div>

            {/* Code files */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Code to Review ({problem.problem_files.length} file{problem.problem_files.length !== 1 ? 's' : ''})
              </h2>
              <CodeViewer files={problem.problem_files} />
            </div>

            {/* Hints */}
            {problem.hints.length > 0 && (
              <div>
                <button
                  onClick={() => {
                    setShowHint(true);
                    if (showHint && hintIndex < problem.hints.length - 1) {
                      setHintIndex(i => i + 1);
                    }
                  }}
                  className="text-sm text-yellow-500 hover:text-yellow-400 underline"
                >
                  {!showHint ? 'Show hint' : `Next hint (${hintIndex + 1}/${problem.hints.length})`}
                </button>
                {showHint && (
                  <div className="mt-2 p-3 bg-yellow-950/30 border border-yellow-800 rounded-lg text-sm text-yellow-200">
                    💡 {problem.hints[hintIndex]}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Submission area */}
          <div className="space-y-6">

            {/* Already solved banner */}
            {alreadySolved && (
              <div className="p-4 bg-green-950/40 border border-green-700 rounded-xl text-green-300 text-sm">
                ✅ You've already solved this problem! You can still practice below.
              </div>
            )}

            {/* State machine */}
            {pageState === 'idle' && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  Your Solution
                </h2>
                <SubmissionForm
                  problemId={problem.id}
                  onSubmitted={handleSubmitted}
                />
                {!alreadySolved && (
                  <button
                    onClick={handleGiveUp}
                    className="mt-4 text-xs text-gray-600 hover:text-gray-400 underline"
                  >
                    I give up — show me the solution
                  </button>
                )}
              </div>
            )}

            {pageState === 'polling' && submissionId && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <SubmissionStatus
                  submissionId={submissionId}
                  onComplete={handlePollingComplete}
                />
              </div>
            )}

            {pageState === 'result' && result && (
              <SubmissionResult
                isCorrect={result.is_correct}
                score={result.ai_score}
                feedback={result.ai_feedback}
                onRetry={() => setPageState('idle')}
                onViewSolution={handleGiveUp}
              />
            )}

            {pageState === 'solution' && (
              <SolutionViewer problemId={problem.id} />
            )}

            {/* Submission history */}
            {submissionHistory.length > 0 && pageState === 'idle' && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Past Submissions
                </h3>
                <div className="space-y-2">
                  {submissionHistory.slice(0, 5).map(sub => (
                    <div key={sub.id} className="flex items-center justify-between text-xs">
                      <span className={sub.is_correct ? 'text-green-400' : 'text-red-400'}>
                        {sub.is_correct ? '✓ Accepted' : '✗ Wrong'}
                      </span>
                      <span className="text-gray-500 font-mono">
                        Score: {sub.ai_score ?? '—'}
                      </span>
                      <span className="text-gray-600">
                        Attempt #{sub.attempt_number}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
