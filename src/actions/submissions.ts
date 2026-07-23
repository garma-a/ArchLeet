'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult, Submission } from '@/lib/types';

// ---- Submit an answer ----
export async function submitAnswer(
  problemId: string,
  answerText: string
): Promise<ActionResult<{ submissionId: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'You must be logged in to submit.' };
  if (!answerText.trim() || answerText.trim().length < 20) {
    return { success: false, error: 'Answer is too short. Explain your solution.' };
  }

  // Count previous attempts for this user+problem
  const { count } = await supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('problem_id', problemId);

  const attemptNumber = (count ?? 0) + 1;

  // Insert submission (status = 'pending' by default — enters the queue)
  const { data: submission, error } = await supabase
    .from('submissions')
    .insert({
      user_id:        user.id,
      problem_id:     problemId,
      answer_text:    answerText.trim(),
      attempt_number: attemptNumber,
    })
    .select('id')
    .single();

  if (error || !submission) {
    return { success: false, error: 'Failed to submit. Please try again.' };
  }

  // Increment attempt count in user_progress
  await supabase.rpc('increment_attempt_count', {
    p_user_id:    user.id,
    p_problem_id: problemId,
  });

  return { success: true, data: { submissionId: submission.id } };
}

// ---- Give up on a problem (unlocks solution) ----
export async function giveUp(problemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Must be logged in.' };

  await supabase
    .from('user_progress')
    .upsert({
      user_id:    user.id,
      problem_id: problemId,
      gave_up:    true,
    }, { onConflict: 'user_id,problem_id' });

  revalidatePath(`/problems`);
  return { success: true, data: undefined };
}

// ---- Get submission history for a user+problem ----
export async function getSubmissionHistory(problemId: string): Promise<Submission[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', user.id)
    .eq('problem_id', problemId)
    .order('submitted_at', { ascending: false })
    .limit(10);

  if (error) return [];
  return data as Submission[];
}
