import 'dotenv/config'; // Make sure to load the env vars including GROQ_API_KEY
import { createClient } from '@supabase/supabase-js';
import { evaluateSubmission } from '../src/lib/groq';
import type { EvaluatorPromptInput } from '../src/lib/evaluator-prompt';

// Use service role to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function processQueue() {
  console.log('Checking for pending submissions...');
  
  // 1. Find a pending submission
  const { data: submissions, error: listError } = await supabase
    .from('submissions')
    .select('*')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })
    .limit(1);

  if (listError) {
    console.error('Error fetching submissions:', listError);
    return;
  }

  if (!submissions || submissions.length === 0) {
    return; // Queue is empty
  }

  const sub = submissions[0];
  const subId = sub.id;
  const userId = sub.user_id;
  const problemId = sub.problem_id;
  const answer = sub.answer_text;

  console.log(`Processing submission ${subId} for problem ${problemId}...`);

  // 2. Mark as processing
  await supabase
    .from('submissions')
    .update({ status: 'processing', processing_started_at: new Date().toISOString() })
    .eq('id', subId);

  try {
    // 3. Fetch problem data
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

    // 4. Call the AI Evaluator
    const evaluatorInput: EvaluatorPromptInput = {
      problemTitle:        problem.title,
      problemDescription:  problem.description,
      problemFiles:        files,
      rubricText:          rubric.rubric_text,
      exampleCorrectAnswer: rubric.example_correct_answer,
      userAnswer:          answer,
      passingScore:        rubric.passing_score,
    };

    console.log('Sending to Groq LLM evaluator...');
    const result = await evaluateSubmission(evaluatorInput);
    console.log(`Evaluated! Score: ${result.score}, Is Correct: ${result.is_correct}`);

    // 5. Save result back to submissions
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

    // 6. Update user progress if it was correct (falling back to direct insert/update since RPC might not be deployed yet)
    if (result.is_correct) {
      console.log('Updating user progress...');
      const { data: progress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('problem_id', problemId)
        .single();
        
      if (progress) {
         await supabase.from('user_progress').update({ 
           is_solved: true, 
           solved_at: progress.solved_at || new Date().toISOString() 
         }).eq('id', progress.id);
      } else {
         await supabase.from('user_progress').insert({
           user_id: userId,
           problem_id: problemId,
           is_solved: true,
           attempt_count: 1,
           solved_at: new Date().toISOString()
         });
      }
    }

    console.log(`Successfully completed submission ${subId}!`);
  } catch (err: any) {
    console.error('Error during evaluation:', err);
    await supabase
      .from('submissions')
      .update({
        status: 'failed',
        ai_feedback: 'Evaluation failed internally. Please retry your submission.'
      })
      .eq('id', subId);
  }
}

// Polling interval
const POLL_INTERVAL_MS = 5000; // 5 seconds

console.log('ArchLeet Queue Worker Started. Press Ctrl+C to stop.');
console.log('Polling for pending submissions every 5 seconds...\n');

// Initial check
processQueue();

setInterval(async () => {
  await processQueue();
}, POLL_INTERVAL_MS);
