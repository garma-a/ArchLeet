-- Safe queue claiming with row-level locking
CREATE OR REPLACE FUNCTION public.claim_next_submission()
RETURNS public.submissions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claimed_submission public.submissions;
BEGIN
  SELECT * INTO claimed_submission
  FROM public.submissions
  WHERE status = 'pending'
    AND processing_attempts < 3
  ORDER BY submitted_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF claimed_submission.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.submissions
  SET
    status                = 'processing',
    processing_started_at = NOW(),
    processing_attempts   = processing_attempts + 1
  WHERE id = claimed_submission.id
  RETURNING * INTO claimed_submission;

  RETURN claimed_submission;
END;
$$;

-- Update user progress on correct submission
CREATE OR REPLACE FUNCTION public.update_progress_on_correct_submission(
  p_user_id UUID,
  p_problem_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_progress (user_id, problem_id, is_solved, attempt_count, solved_at)
  VALUES (p_user_id, p_problem_id, true, 1, NOW())
  ON CONFLICT (user_id, problem_id)
  DO UPDATE SET
    is_solved = true,
    solved_at = COALESCE(public.user_progress.solved_at, NOW());
END;
$$;
