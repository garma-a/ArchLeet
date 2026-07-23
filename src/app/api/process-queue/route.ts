import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateSubmission } from '@/lib/groq';
import type { EvaluatorPromptInput } from '@/lib/evaluator-prompt';

export const maxDuration = 300; // Next.js max duration for this endpoint
export const dynamic = 'force-dynamic';

// Use service role to bypass RLS — this runs server-side only
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // Verify the secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.QUEUE_PROCESSOR_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ---- Step 1: Claim ONE pending submission (safe concurrent locking) ----
  const { data: submission, error: claimError } = await supabase.rpc(
    'claim_next_submission'
  );

  if (claimError) {
    console.error('Failed to claim submission:', claimError);
    return NextResponse.json({ error: 'DB error claiming submission' }, { status: 500 });
  }

  // claim_next_submission returns an array containing 0 or 1 rows
  // Or it returns a single object if there's only one. But RPCs returning table rows usually return arrays.
  const sub = Array.isArray(submission) ? submission[0] : submission;

  if (!sub || !sub.id) {
    return NextResponse.json({ message: 'Queue empty' }, { status: 200 });
  }

  const subId     = sub.id;
  const userId    = sub.user_id;
  const problemId = sub.problem_id;
  const answer    = sub.answer_text;

  try {
    // ---- Step 2: Fetch problem data ----
    const { data: problem, error: problemError } = await supabase
      .from('problems')
      .select('title, description')
      .eq('id', problemId)
      .single();

    if (problemError || !problem) throw new Error('Failed to fetch problem');

    const { data: files, error: filesError } = await supabase
      .from('problem_files')
      .select('filename, language, content')
      .eq('problem_id', problemId)
      .eq('is_solution', false)
      .order('file_order');

    if (filesError || !files) throw new Error('Failed to fetch problem files');

    const { data: rubric, error: rubricError } = await supabase
      .from('solution_rubrics')
      .select('rubric_text, example_correct_answer, passing_score')
      .eq('problem_id', problemId)
      .single();

    if (rubricError || !rubric) throw new Error('Failed to fetch rubric');

    // ---- Step 3: Call the AI ----
    const evaluatorInput: EvaluatorPromptInput = {
      problemTitle:        problem.title,
      problemDescription:  problem.description,
      problemFiles:        files,
      rubricText:          rubric.rubric_text,
      exampleCorrectAnswer: rubric.example_correct_answer,
      userAnswer:          answer,
      passingScore:        rubric.passing_score,
    };

    const result = await evaluateSubmission(evaluatorInput);

    // ---- Step 4: Save result ----
    await supabase
      .from('submissions')
      .update({
        status:       'completed',
        is_correct:   result.is_correct,
        ai_score:     result.score,
        ai_feedback:  result.feedback,
        evaluated_at: new Date().toISOString(),
      })
      .eq('id', subId);

    // ---- Step 5: Update user progress if correct ----
    if (result.is_correct) {
      await supabase.rpc('update_progress_on_correct_submission', {
        p_user_id:    userId,
        p_problem_id: problemId,
      });
    }

    return NextResponse.json({ success: true, submissionId: subId, score: result.score });

  } catch (error: any) {
    console.error('Evaluation failed:', error.message);

    // Mark as failed (or reschedule if attempts < max_attempts)
    await supabase
      .from('submissions')
      .update({
        status:              'failed',
        ai_feedback:         'Evaluation failed internally. Please retry your submission.',
      })
      .eq('id', subId);

    return NextResponse.json({ error: 'Evaluation failed', details: error.message }, { status: 500 });
  }
}
