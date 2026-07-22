-- ============================================================
-- ARCHLEET INITIAL SCHEMA
-- Run this in Supabase SQL editor or via `supabase db push`
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";  -- for HTTP calls from pg_cron

-- ============================================================
-- TABLE: profiles
-- Extends Supabase auth.users. Created automatically on signup
-- via a trigger (see below).
-- ============================================================
CREATE TABLE public.profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT        UNIQUE NOT NULL,
  avatar_url      TEXT,
  bio             TEXT,
  github_url      TEXT,
  total_solved    INT         NOT NULL DEFAULT 0,
  streak_days     INT         NOT NULL DEFAULT 0,
  last_active_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'user_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABLE: problems
-- The core problem entity.
-- ============================================================
CREATE TYPE problem_difficulty AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE problem_category AS ENUM (
  'solid',
  'gof_creational',
  'gof_structural',
  'gof_behavioral',
  'refactoring',
  'testing_antipatterns',
  'system_design'
);

CREATE TABLE public.problems (
  id            UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT               UNIQUE NOT NULL,
  title         TEXT               NOT NULL,
  difficulty    problem_difficulty NOT NULL,
  category      problem_category   NOT NULL,
  description   TEXT               NOT NULL,  -- Markdown. Scenario + goal.
  hints         TEXT[]             DEFAULT '{}',
  tags          TEXT[]             DEFAULT '{}',
  is_published  BOOLEAN            NOT NULL DEFAULT FALSE,
  order_index   INT                NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- Index for fast filtering
CREATE INDEX idx_problems_category    ON public.problems(category);
CREATE INDEX idx_problems_difficulty  ON public.problems(difficulty);
CREATE INDEX idx_problems_published   ON public.problems(is_published);

-- ============================================================
-- TABLE: problem_files
-- The actual bad code files attached to a problem.
-- is_solution = FALSE → shown to user as the problem
-- is_solution = TRUE  → shown ONLY after user solves or gives up
-- ============================================================
CREATE TABLE public.problem_files (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id  UUID    NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  filename    TEXT    NOT NULL,         -- e.g. "UserService.ts"
  language    TEXT    NOT NULL DEFAULT 'typescript',
  content     TEXT    NOT NULL,         -- the raw code content
  file_order  INT     NOT NULL DEFAULT 0,
  is_solution BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_problem_files_problem    ON public.problem_files(problem_id);
CREATE INDEX idx_problem_files_is_solution ON public.problem_files(is_solution);

-- ============================================================
-- TABLE: solution_rubrics
-- NEVER exposed to the client directly.
-- Only read server-side when building the AI evaluation prompt.
-- One rubric per problem.
-- ============================================================
CREATE TABLE public.solution_rubrics (
  id                    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id            UUID  NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE UNIQUE,
  rubric_text           TEXT  NOT NULL,   -- The grading criteria in plain English
  example_correct_answer TEXT,            -- Optional few-shot example for the AI
  passing_score         INT   NOT NULL DEFAULT 70,  -- 0-100 threshold
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: submissions
-- This table ALSO acts as the job queue.
-- status drives the queue state machine.
-- ============================================================
CREATE TYPE submission_status AS ENUM (
  'pending',     -- Inserted, waiting to be picked up
  'processing',  -- Currently being evaluated by AI
  'completed',   -- AI returned a result
  'failed'       -- AI call failed after max_attempts
);

CREATE TABLE public.submissions (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID              NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id          UUID              NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  answer_text         TEXT              NOT NULL,
  status              submission_status NOT NULL DEFAULT 'pending',
  is_correct          BOOLEAN,                    -- NULL until completed
  ai_score            INT,                        -- 0-100
  ai_feedback         TEXT,                       -- Markdown feedback from AI
  attempt_number      INT               NOT NULL DEFAULT 1,
  processing_attempts INT               NOT NULL DEFAULT 0,
  max_attempts        INT               NOT NULL DEFAULT 3,
  submitted_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  evaluated_at        TIMESTAMPTZ
);

-- Indexes for queue polling (critical for performance)
CREATE INDEX idx_submissions_status       ON public.submissions(status);
CREATE INDEX idx_submissions_user         ON public.submissions(user_id);
CREATE INDEX idx_submissions_problem      ON public.submissions(problem_id);
CREATE INDEX idx_submissions_queue        ON public.submissions(status, submitted_at)
  WHERE status = 'pending';

-- ============================================================
-- TABLE: user_progress
-- Tracks per-user per-problem state.
-- ============================================================
CREATE TABLE public.user_progress (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id      UUID  NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  is_solved       BOOLEAN NOT NULL DEFAULT FALSE,
  gave_up         BOOLEAN NOT NULL DEFAULT FALSE,
  first_solved_at TIMESTAMPTZ,
  attempts_count  INT     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, problem_id)
);

CREATE INDEX idx_user_progress_user    ON public.user_progress(user_id);
CREATE INDEX idx_user_progress_problem ON public.user_progress(problem_id);

-- ============================================================
-- FUNCTION: update_user_progress_on_submission
-- Called after a submission is completed by the queue processor.
-- Updates user_progress and profiles.total_solved.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_progress_on_correct_submission(
  p_user_id    UUID,
  p_problem_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  already_solved BOOLEAN;
BEGIN
  SELECT is_solved INTO already_solved
  FROM public.user_progress
  WHERE user_id = p_user_id AND problem_id = p_problem_id;

  IF NOT already_solved THEN
    INSERT INTO public.user_progress (user_id, problem_id, is_solved, first_solved_at)
    VALUES (p_user_id, p_problem_id, TRUE, NOW())
    ON CONFLICT (user_id, problem_id)
    DO UPDATE SET
      is_solved       = TRUE,
      first_solved_at = COALESCE(user_progress.first_solved_at, NOW()),
      updated_at      = NOW();

    UPDATE public.profiles
    SET total_solved = total_solved + 1,
        last_active_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE id = p_user_id;
  END IF;
END;
$$;

-- ============================================================
-- FUNCTION: increment_attempt_count
-- Called every time a user submits, regardless of result.
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_attempt_count(
  p_user_id    UUID,
  p_problem_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_progress (user_id, problem_id, attempts_count)
  VALUES (p_user_id, p_problem_id, 1)
  ON CONFLICT (user_id, problem_id)
  DO UPDATE SET
    attempts_count = user_progress.attempts_count + 1,
    updated_at     = NOW();
END;
$$;

-- ============================================================
-- UPDATED_AT trigger (apply to all tables that have updated_at)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER problems_updated_at
  BEFORE UPDATE ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
