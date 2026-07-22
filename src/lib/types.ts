// ============================================================
// ARCHLEET — Core TypeScript Types
// ============================================================

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ProblemCategory =
  | 'solid'
  | 'gof_creational'
  | 'gof_structural'
  | 'gof_behavioral'
  | 'refactoring'
  | 'testing_antipatterns'
  | 'system_design';

export type SubmissionStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ---- Database Row Types ----

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  github_url: string | null;
  total_solved: number;
  streak_days: number;
  last_active_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  category: ProblemCategory;
  description: string;   // Markdown
  hints: string[];
  tags: string[];
  is_published: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ProblemFile {
  id: string;
  problem_id: string;
  filename: string;
  language: string;
  content: string;
  file_order: number;
  is_solution: boolean;
  created_at: string;
}

export interface SolutionRubric {
  id: string;
  problem_id: string;
  rubric_text: string;
  example_correct_answer: string | null;
  passing_score: number;
  created_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  problem_id: string;
  answer_text: string;
  status: SubmissionStatus;
  is_correct: boolean | null;
  ai_score: number | null;
  ai_feedback: string | null;
  attempt_number: number;
  processing_attempts: number;
  max_attempts: number;
  submitted_at: string;
  processing_started_at: string | null;
  evaluated_at: string | null;
}

export interface UserProgress {
  id: string;
  user_id: string;
  problem_id: string;
  is_solved: boolean;
  gave_up: boolean;
  first_solved_at: string | null;
  attempts_count: number;
  created_at: string;
  updated_at: string;
}

// ---- Composite / View Types (used in UI) ----

export interface ProblemWithFiles extends Problem {
  problem_files: ProblemFile[];   // Only is_solution = false files
}

export interface ProblemListItem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  category: ProblemCategory;
  tags: string[];
  // Joined from user_progress for authenticated users:
  user_status?: 'solved' | 'attempted' | 'unseen';
  total_submissions?: number;
  acceptance_rate?: number;
}

// ---- AI Evaluator Types ----

export interface EvaluatorResult {
  is_correct: boolean;
  score: number;          // 0-100
  feedback: string;       // Markdown, shown to user
}

// ---- Server Action Return Types ----

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
