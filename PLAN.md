# ARCHLEET — MASTER BUILD SPECIFICATION
### "LeetCode for Software Architecture & Design Patterns"
### Version 1.0 | 100% Free-Tier Stack | MVP 7-Day Sprint

---

> **HOW TO USE THIS DOCUMENT**
> This is a complete, self-contained specification for a local LLM to plan and build the
> ArchLeet platform from scratch. Read all parts before writing any code. Every section
> contains decisions, rationale, and exact implementation details. Do not skip parts.

---

## TABLE OF CONTENTS

1. Project Vision & Core Mechanics
2. Complete Tech Stack (100% Free Tier)
3. Database Schema — Full SQL Migration
4. TypeScript Types
5. Project File Structure
6. Environment Variables
7. Supabase Configuration & RLS Policies
8. Authentication Flow — Server Actions
9. Problem Data Format & Supabase Storage
10. Submission Queue System (No Redis — DB-Backed)
11. AI Evaluation Engine — Groq API + Prompt Engineering
12. All Server Actions
13. All API Routes
14. Frontend Pages & Component Specifications
15. Supabase Edge Function — Queue Processor
16. Keep-Alive Cron (GitHub Actions)
17. package.json & Dependencies
18. next.config.ts
19. Deployment Checklist (Vercel + Supabase)
20. 7-Day Sprint Plan
21. Seeding: Two Complete Sample Problems
22. Extensibility Roadmap

---

## PART 1 — PROJECT VISION & CORE MECHANICS

### What This Platform Is
ArchLeet is a free, gamified developer education platform styled after LeetCode.
Instead of algorithmic puzzles, users are presented with multi-file (3–5 files)
production-realistic "spaghetti code" and must identify and fix architectural flaws:
SOLID principle violations, missing or misapplied Gang of Four design patterns,
and poor coupling/cohesion.

### The Exact User Flow (Step by Step)
```
1. User lands on home page → sees problem list with difficulty + category filters
2. User clicks a problem → sees the scenario description + 3–5 bad code files
   rendered in a read-only Monaco code editor (tabbed, one file per tab)
3. User reads the code, thinks, then types their answer in a textarea
   Answer can be: plain English explanation, pseudocode, refactored code snippets,
   or a mix of all three. There is no single correct format.
4. User clicks "Submit"
5. Frontend POSTs to a Server Action → inserts a row into `submissions` table
   with status = 'pending' → returns the submission ID to the client
6. Client polls GET /api/submission-status/[id] every 3 seconds
7. In the background, a Supabase Edge Function (triggered by pg_cron every minute)
   picks up pending submissions and calls the Groq API
8. Groq receives: the problem description + the bad code files + the hidden rubric
   + the user's answer → returns strict JSON: { is_correct: boolean, score: number,
   feedback: string }
9. Submission row is updated with the result
10. Client poll detects status = 'completed' → displays result card
    - If correct (score >= 70): shows success state + confetti + unlocks solution files
    - If incorrect: shows score + feedback + encourages retry 
11. User can view official solution files after solving OR after clicking "Give Up"
```

### The Three Content Types (MVP focuses on first two)
- **Type A — Code Architecture**: Multi-file OOP code with SOLID violations / GoF
  pattern misapplication. User refactors or explains the fix. (MVP)
- **Type B — Testing Anti-Patterns**: Mock-heavy, tightly coupled test files where
  user identifies missing assertions or rewrites the suite. (MVP stretch goal)
- **Type C — System Design**: High-level text scenarios, user proposes scalable
  cloud architecture. (Post-MVP)

### What Makes a Problem Good (Briefing for Content Creation)
- Files must feel like real production code, not toy examples
- Each file should have a clear, named responsibility that is being violated
- The violation must be something a working developer would actually write
- There should be exactly ONE primary pattern/principle to identify, with
  1–2 secondary smells as supporting context
- Difficulty is determined by: how obvious the violation is + how complex the fix is
  - Easy: Single file, one clear SOLID violation, fix is obvious
  - Medium: 2–3 files, pattern misapplication, fix requires restructuring
  - Hard: 4–5 files, cascading violations, fix requires architectural redesign

---

## PART 2 — COMPLETE TECH STACK (100% FREE TIER)

### Hosting: Vercel Hobby (Free)
- Unlimited deployments from GitHub
- 100 GB bandwidth/month
- Serverless functions up to 10s timeout
- 2 Cron Jobs (daily frequency, used for keep-alive)
- Custom domain supported

### Framework: Next.js 15 (App Router)
- Use Server Components by default
- Use Server Actions for all mutations
- Use React Client Components only for interactive UI (Monaco, polling, forms)
- No separate Express/NestJS backend — everything lives in Next.js

### Styling: Tailwind CSS v4
- No component library required for MVP
- Use `shadcn/ui` for complex components (Dialog, Tabs, Badge, Button)
  Install only what is needed, do not install the full library

### Database + Auth + Storage: Supabase Free Tier
- 500 MB PostgreSQL database
- 1 GB file storage (for solution file assets if needed)
- 50,000 monthly active users
- Supabase Auth (Email + OAuth with GitHub/Google)
- pg_cron extension (available on free tier — CRITICAL for queue)
- Supabase Edge Functions (500,000 invocations/month free)
- Supabase Realtime (optional, for live submission status)

### AI Evaluation: Groq Free Tier
- Model: `llama-3.3-70b-versatile` (best quality on free tier)
- Fallback model: `llama-3.1-8b-instant` (faster, lower quality)
- Free limits: 30 RPM, 14,400 requests/day, 6,000 tokens/minute
- The queue processes 1 submission per minute = 60/hour = well within limits
- Backup option: Google Gemini 2.5 Flash (15 RPM, 1,500/day free)

### Code Editor: Monaco Editor (Free, MIT License)
- `@monaco-editor/react` package
- Used READ-ONLY for displaying problem files
- Syntax highlighting for TypeScript, JavaScript, Python, Java
- Tabbed interface for multiple files

### Queue System: Supabase pg_cron + Edge Function (No Redis, No BullMQ)
- `submissions` table acts as the queue
- pg_cron triggers an Edge Function every 60 seconds
- Edge Function uses `SELECT FOR UPDATE SKIP LOCKED` for safe concurrent processing
- Processes one job per tick, preventing API rate limit violations

### Keep-Alive: GitHub Actions (Free)
- Workflow runs every 4 days
- Pings the Supabase database via a lightweight API route
- Prevents Supabase free tier 7-day inactivity pause

---

## PART 3 — DATABASE SCHEMA (FULL SQL MIGRATION)

Save this as: `supabase/migrations/20240101000000_initial_schema.sql`

```sql
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
```

---

## PART 4 — TYPESCRIPT TYPES

Save this as: `lib/types.ts`

```typescript
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
```

---

## PART 5 — PROJECT FILE STRUCTURE

```
archleet/
│
├── app/
│   ├── layout.tsx                          # Root layout, font setup
│   ├── globals.css                         # Tailwind v4 imports
│   │
│   ├── (auth)/
│   │   ├── layout.tsx                      # Centered card layout for auth
│   │   ├── login/
│   │   │   └── page.tsx                    # Login form (email/password + GitHub)
│   │   └── signup/
│   │       └── page.tsx                    # Signup form
│   │
│   ├── (main)/
│   │   ├── layout.tsx                      # Navbar + footer wrapper
│   │   ├── page.tsx                        # Landing / Hero page
│   │   ├── problems/
│   │   │   ├── page.tsx                    # Problem browser with filters
│   │   │   └── [slug]/
│   │   │       └── page.tsx                # Problem detail page (main feature)
│   │   ├── dashboard/
│   │   │   └── page.tsx                    # User progress, stats, history
│   │   └── leaderboard/
│   │       └── page.tsx                    # Top users by problems solved
│   │
│   └── api/
│       ├── submission-status/
│       │   └── [id]/
│       │       └── route.ts                # GET — poll submission status
│       ├── process-queue/
│       │   └── route.ts                    # POST — called by Edge Function/cron
│       └── keep-alive/
│           └── route.ts                    # GET — pinged by GitHub Actions
│
├── actions/
│   ├── auth.ts                             # signUp, signIn, signOut, getUser
│   ├── problems.ts                         # getProblems, getProblemBySlug
│   └── submissions.ts                      # submitAnswer, giveUp, getSubmissionHistory
│
├── components/
│   ├── ui/                                 # shadcn/ui primitives (Button, Badge, etc.)
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   ├── problems/
│   │   ├── ProblemList.tsx                 # Table/grid of problems
│   │   ├── ProblemCard.tsx                 # Single problem row
│   │   ├── ProblemFilters.tsx              # Category + difficulty filter UI
│   │   ├── DifficultyBadge.tsx             # Colored badge (easy/medium/hard)
│   │   └── CategoryTag.tsx
│   ├── editor/
│   │   ├── CodeViewer.tsx                  # Monaco read-only, tabbed
│   │   └── FileTab.tsx                     # Individual file tab
│   ├── submission/
│   │   ├── SubmissionForm.tsx              # Textarea + submit button
│   │   ├── SubmissionStatus.tsx            # Polling UI (loading → result)
│   │   ├── SubmissionResult.tsx            # is_correct card with feedback
│   │   └── SubmissionHistory.tsx           # Past attempts list
│   └── solution/
│       └── SolutionViewer.tsx              # Shown after solve/give-up
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                       # createBrowserClient
│   │   ├── server.ts                       # createServerClient (for Server Components)
│   │   └── middleware.ts                   # Session refresh middleware
│   ├── groq.ts                             # Groq SDK wrapper + evaluateSubmission()
│   ├── evaluator-prompt.ts                 # AI system prompt builder
│   └── types.ts                            # All TypeScript types (see Part 4)
│
├── middleware.ts                           # Supabase Auth session middleware
│
├── supabase/
│   ├── migrations/
│   │   └── 20240101000000_initial_schema.sql
│   ├── functions/
│   │   └── process-queue/
│   │       └── index.ts                    # Deno Edge Function
│   └── seed/
│       └── problems.sql                    # Sample problem data
│
├── .github/
│   └── workflows/
│       └── keep-alive.yml                  # GitHub Actions cron
│
├── .env.local                              # Never commit this
├── .env.example                            # Commit this (no secrets)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## PART 6 — ENVIRONMENT VARIABLES

### `.env.example` (commit to Git — no secrets)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI — pick one or both (fallback)
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key   # optional fallback

# Queue security — a random secret string YOU generate
QUEUE_PROCESSOR_SECRET=a_long_random_string_you_generate

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `.env.local` (never commit)
Fill in real values from:
- Supabase Dashboard → Project Settings → API
- Groq Console → API Keys (https://console.groq.com)
- Generate QUEUE_PROCESSOR_SECRET with: `openssl rand -hex 32`

---

## PART 7 — SUPABASE CONFIGURATION & RLS POLICIES

### Enable Extensions
In Supabase Dashboard → Database → Extensions, enable:
- `uuid-ossp` ✅
- `pg_cron` ✅
- `pg_net` ✅

### Row Level Security Policies

Run this SQL after the schema migration:

```sql
-- ============================================================
-- RLS SETUP
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solution_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress    ENABLE ROW LEVEL SECURITY;

-- ---- profiles ----
-- Anyone can read profiles (for leaderboard)
CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ---- problems ----
-- Anyone can read published problems (no auth required to browse)
CREATE POLICY "problems_public_read" ON public.problems
  FOR SELECT USING (is_published = true);

-- ---- problem_files ----
-- Anyone can read problem files that are NOT solution files
CREATE POLICY "problem_files_public_read" ON public.problem_files
  FOR SELECT USING (is_solution = false);

-- Authenticated users can read solution files ONLY if they solved the problem
-- or gave up on it
CREATE POLICY "solution_files_unlocked_read" ON public.problem_files
  FOR SELECT USING (
    is_solution = false
    OR (
      is_solution = true
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.user_progress
        WHERE user_id   = auth.uid()
          AND problem_id = problem_files.problem_id
          AND (is_solved = true OR gave_up = true)
      )
    )
  );

-- ---- solution_rubrics ----
-- NEVER readable by the client. Service role only.
-- (No SELECT policy = no access from client)
-- The Edge Function uses service role key to read rubrics.

-- ---- submissions ----
-- Users can only see their own submissions
CREATE POLICY "submissions_own_read" ON public.submissions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own submissions
CREATE POLICY "submissions_own_insert" ON public.submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---- user_progress ----
-- Users can read their own progress
CREATE POLICY "progress_own_read" ON public.user_progress
  FOR SELECT USING (auth.uid() = user_id);

-- Anyone can read aggregate data (for leaderboard) — handled via view
```

### Supabase Auth Configuration
In Supabase Dashboard → Authentication → Providers:
- Enable **Email** (confirm email: optional for MVP, disable for faster onboarding)
- Enable **GitHub** OAuth (requires GitHub OAuth App)
- Enable **Google** OAuth (requires Google Cloud credentials)

In Authentication → URL Configuration:
- Site URL: `https://your-app.vercel.app`
- Redirect URLs: `https://your-app.vercel.app/auth/callback`

---

## PART 8 — SUPABASE CLIENT SETUP

### `lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()         { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component, ignore
          }
        },
      },
    }
  );
}

// Service role client — for server-side operations that bypass RLS
// Use ONLY in Server Actions and API routes, NEVER expose to client
export async function createServiceClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll()             { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

### `middleware.ts` (root of project)
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

## PART 9 — AUTHENTICATION SERVER ACTIONS

### `actions/auth.ts`
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

export async function signUp(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const email    = formData.get('email') as string;
  const password = formData.get('password') as string;
  const username = formData.get('username') as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { user_name: username },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) return { success: false, error: error.message };
  revalidatePath('/');
  return { success: true, data: undefined };
}

export async function signIn(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const email    = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  revalidatePath('/');
  redirect('/problems');
}

export async function signInWithGitHub() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error) return { success: false, error: error.message };
  if (data.url) redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/');
  redirect('/');
}

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

---

## PART 10 — PROBLEM SERVER ACTIONS

### `actions/problems.ts`
```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import type { ProblemListItem, ProblemWithFiles, Difficulty, ProblemCategory } from '@/lib/types';

export interface GetProblemsOptions {
  category?: ProblemCategory;
  difficulty?: Difficulty;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getProblems(options: GetProblemsOptions = {}): Promise<ProblemListItem[]> {
  const supabase  = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { category, difficulty, search, page = 1, pageSize = 20 } = options;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('problems')
    .select('id, slug, title, difficulty, category, tags')
    .eq('is_published', true)
    .order('order_index', { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (category)   query = query.eq('category', category);
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (search)     query = query.ilike('title', `%${search}%`);

  const { data: problems, error } = await query;
  if (error || !problems) return [];

  // If authenticated, attach user's solve status
  if (user) {
    const problemIds = problems.map(p => p.id);
    const { data: progress } = await supabase
      .from('user_progress')
      .select('problem_id, is_solved, attempts_count')
      .eq('user_id', user.id)
      .in('problem_id', problemIds);

    const progressMap = new Map(progress?.map(p => [p.problem_id, p]) ?? []);

    return problems.map(p => {
      const prog = progressMap.get(p.id);
      return {
        ...p,
        user_status: prog?.is_solved
          ? 'solved'
          : (prog?.attempts_count ?? 0) > 0
          ? 'attempted'
          : 'unseen',
      } as ProblemListItem;
    });
  }

  return problems as ProblemListItem[];
}

export async function getProblemBySlug(slug: string): Promise<ProblemWithFiles | null> {
  const supabase = await createClient();

  const { data: problem, error } = await supabase
    .from('problems')
    .select(`
      *,
      problem_files(*)
    `)
    .eq('slug', slug)
    .eq('is_published', true)
    .eq('problem_files.is_solution', false)   // Only return problem files, not solutions
    .single();

  if (error || !problem) return null;

  // Sort files by file_order
  problem.problem_files?.sort((a: any, b: any) => a.file_order - b.file_order);

  return problem as ProblemWithFiles;
}

export async function getSolutionFiles(problemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS handles the access check automatically
  const { data, error } = await supabase
    .from('problem_files')
    .select('*')
    .eq('problem_id', problemId)
    .eq('is_solution', true)
    .order('file_order');

  if (error) return null;
  return data;
}
```

---

## PART 11 — SUBMISSION SERVER ACTIONS

### `actions/submissions.ts`
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
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

  revalidatePath(`/problems/${problemId}`);
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
```

---

## PART 12 — AI EVALUATION ENGINE

### `lib/evaluator-prompt.ts`
```typescript
// ============================================================
// ARCHLEET — AI Evaluator Prompt Builder
// This prompt is NEVER sent to the client.
// It is only used server-side in the queue processor.
// ============================================================

export interface EvaluatorPromptInput {
  problemTitle:       string;
  problemDescription: string;
  problemFiles:       Array<{ filename: string; language: string; content: string }>;
  rubricText:         string;
  exampleCorrectAnswer?: string | null;
  userAnswer:         string;
  passingScore:       number;
}

export function buildSystemPrompt(): string {
  return `You are an expert software architect and engineering mentor. 
Your sole job is to evaluate student answers to code architecture challenges.

CRITICAL RULES:
1. You MUST respond with ONLY valid JSON. No preamble, no markdown, no explanation outside the JSON.
2. The JSON schema is EXACTLY: { "is_correct": boolean, "score": number, "feedback": string }
3. "score" is an integer from 0 to 100.
4. "is_correct" is true if and only if score >= PASSING_SCORE (provided in the user message).
5. "feedback" is a markdown string, 2–5 sentences. Be specific about what the student got right or wrong.
6. You MUST be strict. A student who identifies the wrong pattern or principle scores 0–30.
7. You MUST be fair. Correct answers do not need to match the rubric word-for-word. Credit unconventional but valid approaches.
8. If the student's answer is too vague (e.g., "use better OOP"), score it 10–20 and explain why.
9. Do NOT be lenient to compensate for the student's frustration. Your grading must be consistent.

GRADING RUBRIC SCALE:
- 0–20:  Student identified nothing meaningful or completely missed the point.
- 21–40: Student identified the general area (e.g., "this code is tightly coupled") but no specifics.
- 41–60: Student identified the correct principle/pattern but explained the fix incorrectly or incompletely.
- 61–69: Student was close but missed a key element of the solution (just below passing).
- 70–85: Student correctly identified the problem and proposed a valid fix. Passes.
- 86–100: Student correctly identified the problem, proposed an excellent fix, AND noted secondary issues.`;
}

export function buildUserPrompt(input: EvaluatorPromptInput): string {
  const filesSection = input.problemFiles
    .map(f => `### File: ${f.filename}\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
    .join('\n\n');

  const exampleSection = input.exampleCorrectAnswer
    ? `\n\n## EXAMPLE OF A CORRECT ANSWER (for your reference only, not shown to student)\n${input.exampleCorrectAnswer}`
    : '';

  return `## PROBLEM TITLE
${input.problemTitle}

## PROBLEM DESCRIPTION
${input.problemDescription}

## THE BAD CODE FILES (what the student was given to analyze)
${filesSection}

## GRADING RUBRIC (HIDDEN from student — use this to evaluate)
${input.rubricText}
${exampleSection}

## STUDENT'S ANSWER
${input.userAnswer}

## PASSING SCORE THRESHOLD
A score of ${input.passingScore} or above = is_correct: true

## YOUR TASK
Evaluate the student's answer against the rubric. Respond ONLY with valid JSON matching this exact schema:
{"is_correct": boolean, "score": number, "feedback": string}`;
}
```

### `lib/groq.ts`
```typescript
import Groq from 'groq-sdk';
import { buildSystemPrompt, buildUserPrompt, type EvaluatorPromptInput } from './evaluator-prompt';
import type { EvaluatorResult } from './types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const PRIMARY_MODEL   = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL  = 'llama-3.1-8b-instant';

export async function evaluateSubmission(
  input: EvaluatorPromptInput,
  retryWithFallback = true
): Promise<EvaluatorResult> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt(input);

  async function callModel(model: string): Promise<EvaluatorResult> {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature:      0.1,   // Low temperature = consistent grading
      max_tokens:       512,
      response_format:  { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`AI returned invalid JSON: ${raw.slice(0, 200)}`);
    }

    // Validate the shape
    if (typeof parsed.is_correct !== 'boolean') {
      throw new Error('AI response missing is_correct boolean');
    }
    if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
      throw new Error('AI response has invalid score');
    }
    if (typeof parsed.feedback !== 'string') {
      throw new Error('AI response missing feedback string');
    }

    return {
      is_correct: parsed.is_correct,
      score:      Math.round(parsed.score),
      feedback:   parsed.feedback,
    };
  }

  try {
    return await callModel(PRIMARY_MODEL);
  } catch (error) {
    if (retryWithFallback) {
      console.warn('Primary model failed, trying fallback:', error);
      return await callModel(FALLBACK_MODEL);
    }
    throw error;
  }
}
```

---

## PART 13 — QUEUE PROCESSOR API ROUTE

This route is called by the Supabase Edge Function (or pg_cron) every 60 seconds.
It processes ONE pending submission per call to stay within Groq rate limits.

### `app/api/process-queue/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateSubmission }       from '@/lib/groq';
import type { EvaluatorPromptInput } from '@/lib/evaluator-prompt';

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
  // Using a CTE with FOR UPDATE SKIP LOCKED to prevent double-processing
  const { data: submission, error: claimError } = await supabase.rpc(
    'claim_next_submission'
  );

  // If the RPC doesn't exist yet, use this raw query approach:
  // (See the SQL function definition below)

  if (claimError) {
    console.error('Failed to claim submission:', claimError);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  if (!submission) {
    return NextResponse.json({ message: 'Queue empty' }, { status: 200 });
  }

  const subId     = submission.id;
  const userId    = submission.user_id;
  const problemId = submission.problem_id;
  const answer    = submission.answer_text;

  try {
    // ---- Step 2: Fetch problem data ----
    const { data: problem } = await supabase
      .from('problems')
      .select('title, description')
      .eq('id', problemId)
      .single();

    const { data: files } = await supabase
      .from('problem_files')
      .select('filename, language, content')
      .eq('problem_id', problemId)
      .eq('is_solution', false)
      .order('file_order');

    const { data: rubric } = await supabase
      .from('solution_rubrics')
      .select('rubric_text, example_correct_answer, passing_score')
      .eq('problem_id', problemId)
      .single();

    if (!problem || !files || !rubric) {
      throw new Error('Missing problem data for evaluation');
    }

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
        processing_attempts: submission.processing_attempts + 1,
        ai_feedback:         'Evaluation failed. Please retry your submission.',
      })
      .eq('id', subId);

    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}
```

### SQL Function: `claim_next_submission`
Add this to your migration or run it manually:

```sql
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
    AND processing_attempts < max_attempts
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
```

---

## PART 14 — SUBMISSION STATUS POLL ROUTE

The client polls this every 3 seconds after submitting.

### `app/api/submission-status/[id]/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('id, status, is_correct, ai_score, ai_feedback, evaluated_at')
    .eq('id', params.id)
    .eq('user_id', user.id)   // Security: only own submissions
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
```

---

## PART 15 — SUPABASE EDGE FUNCTION (QUEUE TRIGGER)

Save as: `supabase/functions/process-queue/index.ts`

This Deno function is deployed to Supabase and invoked by pg_cron every 60 seconds.
It calls the Next.js API route to process one submission.

```typescript
// Supabase Edge Function — Deno runtime
Deno.serve(async (_req: Request) => {
  const appUrl    = Deno.env.get('APP_URL')!;
  const secret    = Deno.env.get('QUEUE_PROCESSOR_SECRET')!;

  try {
    const response = await fetch(`${appUrl}/api/process-queue`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${secret}`,
      },
    });

    const body = await response.json();
    return new Response(JSON.stringify(body), { status: response.status });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
```

### pg_cron Setup
Run this SQL in Supabase to schedule the Edge Function every 60 seconds:

```sql
-- Schedule the queue processor to run every minute
SELECT cron.schedule(
  'process-submission-queue',
  '* * * * *',   -- Every minute (cron syntax)
  $$
  SELECT net.http_post(
    url     := 'https://<your-project-ref>.supabase.co/functions/v1/process-queue',
    headers := '{"Authorization": "Bearer <your-supabase-anon-key>", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Note: Replace `<your-project-ref>` and `<your-supabase-anon-key>` with real values.
Edge Function environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
- `APP_URL` = your Vercel deployment URL
- `QUEUE_PROCESSOR_SECRET` = same value as in `.env.local`

---

## PART 16 — KEEP-ALIVE CRON (GITHUB ACTIONS)

### `app/api/keep-alive/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  // Simple read to prevent Supabase inactivity pause
  const { count } = await supabase
    .from('problems')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({ alive: true, problemCount: count });
}
```

### `.github/workflows/keep-alive.yml`
```yaml
name: Keep Supabase Alive

on:
  schedule:
    - cron: '0 9 */4 * *'   # Every 4 days at 09:00 UTC
  workflow_dispatch:          # Allow manual trigger

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping database keep-alive endpoint
        run: |
          curl -f "${{ secrets.APP_URL }}/api/keep-alive" \
            -H "User-Agent: GitHub-Actions-KeepAlive"
```

Add `APP_URL` to GitHub Secrets (Repository Settings → Secrets → Actions).

---

## PART 17 — FRONTEND COMPONENTS (SPECIFICATIONS)

### `components/editor/CodeViewer.tsx`
```typescript
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ProblemFile } from '@/lib/types';

// Lazy-load Monaco to avoid SSR issues
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  { ssr: false, loading: () => <div className="h-64 bg-gray-900 animate-pulse rounded" /> }
);

interface CodeViewerProps {
  files: Pick<ProblemFile, 'filename' | 'language' | 'content'>[];
}

export function CodeViewer({ files }: CodeViewerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const activeFile = files[activeTab];

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* File tabs */}
      <div className="flex bg-gray-800 border-b border-gray-700 overflow-x-auto">
        {files.map((file, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`px-4 py-2 text-sm font-mono whitespace-nowrap transition-colors ${
              idx === activeTab
                ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-750'
            }`}
          >
            {file.filename}
          </button>
        ))}
      </div>

      {/* Monaco editor — read-only */}
      <MonacoEditor
        height="450px"
        language={activeFile.language}
        value={activeFile.content}
        theme="vs-dark"
        options={{
          readOnly:          true,
          minimap:           { enabled: false },
          fontSize:          13,
          lineNumbers:       'on',
          scrollBeyondLastLine: false,
          wordWrap:          'on',
          renderLineHighlight: 'none',
          contextmenu:       false,
          folding:           true,
          automaticLayout:   true,
        }}
      />
    </div>
  );
}
```

### `components/submission/SubmissionForm.tsx`
```typescript
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
```

### `components/submission/SubmissionStatus.tsx`
```typescript
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
```

### `components/submission/SubmissionResult.tsx`
```typescript
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
```

---

## PART 18 — MAIN PROBLEM PAGE

### `app/(main)/problems/[slug]/page.tsx`
```typescript
import { notFound }             from 'next/navigation';
import { getProblemBySlug }     from '@/actions/problems';
import { getSubmissionHistory } from '@/actions/submissions';
import { ProblemDetailClient }  from './ProblemDetailClient';

interface Props {
  params: { slug: string };
}

// This is a Server Component — fetches data, then passes to client
export default async function ProblemPage({ params }: Props) {
  const [problem, history] = await Promise.all([
    getProblemBySlug(params.slug),
    getSubmissionHistory(params.slug), // will be empty if not logged in
  ]);

  if (!problem) notFound();

  return <ProblemDetailClient problem={problem} submissionHistory={history} />;
}

export async function generateMetadata({ params }: Props) {
  const problem = await getProblemBySlug(params.slug);
  if (!problem) return {};
  return {
    title: `${problem.title} | ArchLeet`,
    description: `Solve a ${problem.difficulty} ${problem.category} architecture challenge.`,
  };
}
```

### `app/(main)/problems/[slug]/ProblemDetailClient.tsx`
```typescript
'use client';
// This is the interactive client component for the problem page.
// It manages the submission state machine:
// idle → submitting → polling → result → (retry | solution)

import { useState }            from 'react';
import { CodeViewer }          from '@/components/editor/CodeViewer';
import { SubmissionForm }      from '@/components/submission/SubmissionForm';
import { SubmissionStatus }    from '@/components/submission/SubmissionStatus';
import { SubmissionResult }    from '@/components/submission/SubmissionResult';
import { SolutionViewer }      from '@/components/solution/SolutionViewer';
import { DifficultyBadge }     from '@/components/problems/DifficultyBadge';
import { giveUp }              from '@/actions/submissions';
import type { ProblemWithFiles, Submission } from '@/lib/types';
import ReactMarkdown from 'react-markdown';

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
                <ReactMarkdown>{problem.description}</ReactMarkdown>
              </div>
            </div>

            {/* Code files */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Code to Review ({problem.problem_files.length} file
                {problem.problem_files.length > 1 ? 's' : ''})
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
```

---

## PART 19 — PACKAGE.JSON & DEPENDENCIES

```json
{
  "name": "archleet",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev":   "next dev",
    "build": "next build",
    "start": "next start",
    "lint":  "next lint"
  },
  "dependencies": {
    "@monaco-editor/react":   "^4.6.0",
    "@supabase/ssr":          "^0.5.0",
    "@supabase/supabase-js":  "^2.45.0",
    "groq-sdk":               "^0.5.0",
    "next":                   "15.0.0",
    "react":                  "^18.3.0",
    "react-dom":              "^18.3.0",
    "react-markdown":         "^9.0.0",
    "tailwindcss":            "^4.0.0"
  },
  "devDependencies": {
    "@types/node":    "^22.0.0",
    "@types/react":   "^18.3.0",
    "typescript":     "^5.6.0"
  }
}
```

Install command:
```bash
npm install
# then install Monaco separately (large package, lazy-loaded):
npm install @monaco-editor/react
```

---

## PART 20 — `next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  // Supabase Realtime requires this
  serverExternalPackages: ['@supabase/supabase-js'],
};

export default nextConfig;
```

---

## PART 21 — SEED DATA: TWO COMPLETE SAMPLE PROBLEMS

### Problem 1: "The God Service" (Easy — SRP Violation)

```sql
-- Insert the problem
INSERT INTO public.problems (slug, title, difficulty, category, description, hints, tags, is_published, order_index)
VALUES (
  'the-god-service',
  'The God Service',
  'easy',
  'solid',
  E'## Scenario\n\nYou have inherited a Node.js e-commerce backend from a developer who just quit. The ``UserService`` class is the heart of the codebase. It handles everything related to users.\n\n## Your Task\n\nAnalyze the code files provided. Identify the **primary architectural problem** (name the specific principle being violated), explain **why** it is a problem, and describe **how you would fix it**. Name any design patterns you would introduce.\n\n> You do not need to write complete code. A clear explanation with class names and method signatures is enough.',
  ARRAY[
    'Think about what would happen if the email sending logic needed to change. How many places in the codebase would be affected?',
    'Count how many distinct reasons there are for this class to change. Each reason is a separate responsibility.',
    'The S in SOLID stands for something specific. What is the rule, and how many times is it broken here?'
  ],
  ARRAY['SOLID', 'SRP', 'refactoring', 'separation of concerns'],
  true,
  1
);

-- Insert the problem ID into a variable for subsequent inserts
-- (Replace 'THE_PROBLEM_UUID' with the actual UUID returned above in practice)

-- Problem files (bad code)
INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'UserService.ts', 'typescript',
E'import { Database } from ''./db'';\nimport * as bcrypt from ''bcrypt'';\nimport * as nodemailer from ''nodemailer'';\nimport * as jwt from ''jsonwebtoken'';\nimport * as fs from ''fs'';\nimport * as path from ''path'';\n\nexport class UserService {\n  private db: Database;\n  private mailer: nodemailer.Transporter;\n\n  constructor() {\n    this.db = new Database(process.env.DATABASE_URL!);\n    this.mailer = nodemailer.createTransport({\n      host: ''smtp.gmail.com'',\n      port: 587,\n      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },\n    });\n  }\n\n  // --- Authentication ---\n  async register(email: string, password: string, name: string) {\n    const existing = await this.db.query(''SELECT id FROM users WHERE email = $1'', [email]);\n    if (existing.rows.length > 0) throw new Error(''Email already in use'');\n\n    const hashed = await bcrypt.hash(password, 12);\n    const result = await this.db.query(\n      ''INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id'',\n      [email, hashed, name]\n    );\n    const userId = result.rows[0].id;\n\n    // Send welcome email inline\n    const templatePath = path.join(__dirname, ''templates'', ''welcome.html'');\n    const template     = fs.readFileSync(templatePath, ''utf-8'');\n    const html         = template.replace(''{{name}}'', name);\n    await this.mailer.sendMail({\n      from: ''noreply@shop.com'',\n      to:   email,\n      subject: ''Welcome to our shop!'',\n      html,\n    });\n\n    // Auto-generate and return JWT inline\n    const token = jwt.sign({ userId, email }, process.env.JWT_SECRET!, { expiresIn: ''7d'' });\n    return { userId, token };\n  }\n\n  async login(email: string, password: string) {\n    const result = await this.db.query(''SELECT * FROM users WHERE email = $1'', [email]);\n    if (result.rows.length === 0) throw new Error(''User not found'');\n\n    const user = result.rows[0];\n    const valid = await bcrypt.compare(password, user.password_hash);\n    if (!valid) throw new Error(''Invalid password'');\n\n    const token = jwt.sign({ userId: user.id, email }, process.env.JWT_SECRET!, { expiresIn: ''7d'' });\n\n    // Log the login event directly to a file\n    const logEntry = `${new Date().toISOString()} - User ${user.id} logged in from ${"IP UNKNOWN"}\\n`;\n    fs.appendFileSync(path.join(__dirname, ''logs'', ''auth.log''), logEntry);\n\n    return { userId: user.id, token };\n  }\n\n  // --- Profile ---\n  async getProfile(userId: string) {\n    const result = await this.db.query(''SELECT id, email, name, avatar_url FROM users WHERE id = $1'', [userId]);\n    return result.rows[0] ?? null;\n  }\n\n  async updateAvatar(userId: string, imageBuffer: Buffer, mimeType: string) {\n    // Resize + save image to disk inline (should be cloud storage)\n    const filename   = `avatar_${userId}_${Date.now()}.jpg`;\n    const uploadPath = path.join(__dirname, ''uploads'', filename);\n    fs.writeFileSync(uploadPath, imageBuffer);\n\n    const publicUrl = `/uploads/${filename}`;\n    await this.db.query(''UPDATE users SET avatar_url = $1 WHERE id = $2'', [publicUrl, userId]);\n    return publicUrl;\n  }\n\n  // --- Password Reset ---\n  async requestPasswordReset(email: string) {\n    const result = await this.db.query(''SELECT id FROM users WHERE email = $1'', [email]);\n    if (result.rows.length === 0) return; // Silent fail for security\n\n    const token   = Math.random().toString(36).slice(2) + Date.now();\n    const expires = new Date(Date.now() + 3600 * 1000);\n    await this.db.query(\n      ''INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)'',\n      [result.rows[0].id, token, expires]\n    );\n\n    // Send email inline again\n    await this.mailer.sendMail({\n      from:    ''noreply@shop.com'',\n      to:      email,\n      subject: ''Password reset'',\n      html:    `<a href="https://shop.com/reset?token=${token}">Reset your password</a>`,\n    });\n  }\n\n  // --- Reporting (!!!) ---\n  async generateMonthlyUserReport(): Promise<Buffer> {\n    const result = await this.db.query(\n      `SELECT DATE_TRUNC(''month'', created_at) as month, COUNT(*) as signups\n       FROM users GROUP BY month ORDER BY month DESC LIMIT 12`\n    );\n\n    // Build CSV inline\n    let csv = ''Month,New Signups\\n'';\n    for (const row of result.rows) {\n      csv += `${row.month.toISOString().slice(0,7)},${row.signups}\\n`;\n    }\n    return Buffer.from(csv);\n  }\n}\n',
0, false
FROM public.problems WHERE slug = 'the-god-service';

-- Solution files
INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'UserService.ts', 'typescript',
E'// SOLUTION: UserService is now a thin coordinator.\n// It only orchestrates — it does not implement auth, email, or reporting.\nimport { AuthService }    from ''./AuthService'';\nimport { EmailService }   from ''./EmailService'';\nimport { FileService }    from ''./FileService'';\nimport { ReportService }  from ''./ReportService'';\nimport { UserRepository } from ''./UserRepository'';\n\nexport class UserService {\n  constructor(\n    private readonly users:    UserRepository,\n    private readonly auth:     AuthService,\n    private readonly email:    EmailService,\n    private readonly files:    FileService,\n    private readonly reports:  ReportService\n  ) {}\n\n  async register(email: string, password: string, name: string) {\n    if (await this.users.findByEmail(email)) throw new Error(''Email already in use'');\n    const hashed = await this.auth.hashPassword(password);\n    const user   = await this.users.create({ email, passwordHash: hashed, name });\n    const token  = this.auth.generateToken(user.id, email);\n    await this.email.sendWelcome(email, name);\n    return { userId: user.id, token };\n  }\n\n  async login(email: string, password: string) {\n    const user  = await this.users.findByEmail(email);\n    if (!user) throw new Error(''User not found'');\n    await this.auth.verifyPassword(password, user.passwordHash);\n    const token = this.auth.generateToken(user.id, email);\n    return { userId: user.id, token };\n  }\n\n  async updateAvatar(userId: string, buffer: Buffer, mimeType: string) {\n    const url = await this.files.uploadAvatar(userId, buffer, mimeType);\n    await this.users.updateAvatarUrl(userId, url);\n    return url;\n  }\n\n  async generateMonthlyReport(): Promise<Buffer> {\n    return this.reports.generateUserSignupReport();\n  }\n}\n',
0, true
FROM public.problems WHERE slug = 'the-god-service';

-- Rubric
INSERT INTO public.solution_rubrics (problem_id, rubric_text, example_correct_answer, passing_score)
SELECT id,
'GRADING CRITERIA for "The God Service":

PRIMARY VIOLATION (50 points):
The student must correctly identify that UserService violates the Single Responsibility Principle (SRP).
A class should have only one reason to change. UserService has AT LEAST 5:
1. Authentication logic changes (password hashing, JWT)
2. Email template or provider changes
3. File storage strategy changes (disk → S3)
4. Reporting format changes
5. Database schema changes

SECONDARY OBSERVATIONS (20 points, at least one needed):
- The email sending code is duplicated between register() and requestPasswordReset()
- File writes happen inline (tight coupling to the filesystem)
- The JWT secret and email credentials are hard-coded into this class
- The password reset token generator uses Math.random() (not cryptographically secure)

PROPOSED FIX (30 points):
Student must propose splitting into separate services. Correct answers include:
- AuthService (handles hashing, JWT generation, token verification)
- EmailService (handles all email sending)
- FileService or StorageService (handles file uploads)
- ReportService (handles analytics/CSV generation)
- UserRepository (handles raw database queries)
The student does NOT need to name all five. Identifying 2-3 and explaining the principle scores 70+.

DO NOT PASS if:
- Student says "use a design pattern" without identifying SRP
- Student only mentions "the class is too long" without naming SRP
- Student identifies the wrong principle (e.g., says it violates DIP or OCP primarily)',
'The UserService violates the Single Responsibility Principle. It has at least 5 reasons to change: if we switch email providers, if we change JWT secrets or expiry, if we move files to S3, if we change the CSV report format, or if the database schema changes. The fix is to extract: an AuthService for password hashing and JWT logic, an EmailService for all email sending, a FileService for uploads, and a ReportService for analytics. The UserService becomes a thin coordinator that calls these services. This also eliminates the duplicated mailer.sendMail() calls between register() and requestPasswordReset().',
70
FROM public.problems WHERE slug = 'the-god-service';
```

---

### Problem 2: "The Notification Nightmare" (Medium — OCP + Strategy Pattern)

```sql
INSERT INTO public.problems (slug, title, difficulty, category, description, hints, tags, is_published, order_index)
VALUES (
  'the-notification-nightmare',
  'The Notification Nightmare',
  'medium',
  'gof_behavioral',
  E'## Scenario\n\nYour team''s ``NotificationService`` started with just email notifications. Since then, SMS and Slack were bolted on. A new requirement just arrived: the product team wants push notifications added **by next Friday**.\n\nA senior engineer reviewed the code and said: *"If we add push notifications the same way we added SMS, I''m quitting."*\n\n## Your Task\n\n1. Identify the **specific SOLID principle** being violated and explain why.\n2. Name the **GoF design pattern** that would solve this problem.\n3. Describe the **refactored structure** in enough detail that a developer could implement it without your help. Include interface names, method signatures, and how the service would use them.',
  ARRAY[
    'Every time a new channel is added, what happens to the existing class? Is that acceptable?',
    'What would happen to this class in 6 months if you added push, WhatsApp, Telegram, and in-app notifications?',
    'There is a famous GoF behavioral pattern specifically designed for this problem. It defines a family of algorithms (here: notification channels) and makes them interchangeable.'
  ],
  ARRAY['SOLID', 'OCP', 'Strategy Pattern', 'GoF', 'Behavioral'],
  true,
  2
);

INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'NotificationService.ts', 'typescript',
E'export type NotificationChannel = ''email'' | ''sms'' | ''slack'';\n\nexport interface NotificationPayload {\n  recipientId: string;\n  subject:     string;\n  message:     string;\n  metadata?:   Record<string, string>;\n}\n\nexport class NotificationService {\n  async send(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {\n    if (channel === ''email'') {\n      await this.sendEmail(payload);\n    } else if (channel === ''sms'') {\n      await this.sendSms(payload);\n    } else if (channel === ''slack'') {\n      await this.sendSlack(payload);\n    } else {\n      throw new Error(`Unsupported channel: ${channel}`);\n    }\n  }\n\n  async sendBulk(channel: NotificationChannel, payloads: NotificationPayload[]): Promise<void> {\n    for (const payload of payloads) {\n      if (channel === ''email'') {\n        await this.sendEmail(payload);\n      } else if (channel === ''sms'') {\n        await this.sendSms(payload);\n      } else if (channel === ''slack'') {\n        await this.sendSlack(payload);\n      }\n    }\n  }\n\n  async getUserPreferredChannel(userId: string): Promise<NotificationChannel> {\n    // Imagine this queries a DB\n    return ''email'';\n  }\n\n  async notifyByPreference(userId: string, payload: NotificationPayload): Promise<void> {\n    const channel = await this.getUserPreferredChannel(userId);\n    if (channel === ''email'') {\n      await this.sendEmail(payload);\n    } else if (channel === ''sms'') {\n      await this.sendSms(payload);\n    } else if (channel === ''slack'') {\n      await this.sendSlack(payload);\n    }\n  }\n\n  private async sendEmail(payload: NotificationPayload): Promise<void> {\n    console.log(`[EMAIL] To: ${payload.recipientId} | ${payload.subject}`);\n    // ... nodemailer logic ...\n  }\n\n  private async sendSms(payload: NotificationPayload): Promise<void> {\n    console.log(`[SMS] To: ${payload.recipientId} | ${payload.message.slice(0, 160)}`);\n    // ... Twilio logic ...\n  }\n\n  private async sendSlack(payload: NotificationPayload): Promise<void> {\n    const webhookUrl = payload.metadata?.[''slackWebhook''] ?? '''';\n    console.log(`[SLACK] Webhook: ${webhookUrl} | ${payload.message}`);\n    // ... Slack WebClient logic ...\n  }\n}\n',
0, false
FROM public.problems WHERE slug = 'the-notification-nightmare';

INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'UserPreferenceService.ts', 'typescript',
E'// This service is tightly coupled to the hardcoded channel list\nexport class UserPreferenceService {\n  async getChannelForUser(userId: string): Promise<''email'' | ''sms'' | ''slack''> {\n    // In a real app, query the DB:\n    // SELECT preferred_channel FROM user_settings WHERE user_id = $1\n    const mockPreferences: Record<string, ''email'' | ''sms'' | ''slack''> = {\n      ''user_001'': ''email'',\n      ''user_002'': ''sms'',\n      ''user_003'': ''slack'',\n    };\n    return mockPreferences[userId] ?? ''email'';\n  }\n\n  // When push is added, this signature MUST change too:\n  async setChannelForUser(userId: string, channel: ''email'' | ''sms'' | ''slack''): Promise<void> {\n    console.log(`Setting ${userId} preferred channel to ${channel}`);\n  }\n}\n',
1, false
FROM public.problems WHERE slug = 'the-notification-nightmare';

-- Solution files
INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'INotificationChannel.ts', 'typescript',
E'// SOLUTION FILE 1: The Strategy interface\n// Adding a new channel means implementing this interface — nothing else changes.\nexport interface INotificationChannel {\n  readonly channelName: string;\n  send(payload: NotificationPayload): Promise<void>;\n}\n\nexport interface NotificationPayload {\n  recipientId: string;\n  subject:     string;\n  message:     string;\n  metadata?:   Record<string, string>;\n}\n',
0, true
FROM public.problems WHERE slug = 'the-notification-nightmare';

INSERT INTO public.problem_files (problem_id, filename, language, content, file_order, is_solution)
SELECT id, 'NotificationService.ts', 'typescript',
E'// SOLUTION FILE 2: The Context — open for extension, closed for modification\nimport type { INotificationChannel, NotificationPayload } from ''./INotificationChannel'';\n\nexport class NotificationService {\n  private channels = new Map<string, INotificationChannel>();\n\n  // Register any channel at runtime — no switch/if chains needed\n  registerChannel(channel: INotificationChannel): void {\n    this.channels.set(channel.channelName, channel);\n  }\n\n  async send(channelName: string, payload: NotificationPayload): Promise<void> {\n    const channel = this.channels.get(channelName);\n    if (!channel) throw new Error(`Channel not registered: ${channelName}`);\n    await channel.send(payload);\n  }\n\n  async sendBulk(channelName: string, payloads: NotificationPayload[]): Promise<void> {\n    await Promise.all(payloads.map(p => this.send(channelName, p)));\n  }\n}\n\n// Usage (in app bootstrap / DI container):\n// const service = new NotificationService();\n// service.registerChannel(new EmailChannel());\n// service.registerChannel(new SmsChannel());\n// service.registerChannel(new SlackChannel());\n// service.registerChannel(new PushChannel()); // Zero changes to NotificationService!\n',
1, true
FROM public.problems WHERE slug = 'the-notification-nightmare';

-- Rubric
INSERT INTO public.solution_rubrics (problem_id, rubric_text, example_correct_answer, passing_score)
SELECT id,
'GRADING CRITERIA for "The Notification Nightmare":

VIOLATION IDENTIFICATION (35 points):
The student must identify the Open/Closed Principle (OCP) violation.
The class is NOT closed for modification: every new channel requires editing send(), sendBulk(), and notifyByPreference() — adding push notifications would require touching the class in 3 places.
Bonus (5 points): Student also notes that the string union type ''email'' | ''sms'' | ''slack'' in UserPreferenceService must also be updated.

PATTERN IDENTIFICATION (25 points):
Student must name the Strategy Pattern.
Accept also: Strategy + Registry Pattern (bonus 5 points if they mention the registry).
Do NOT accept: "Factory Pattern", "Template Method", or "Observer" as the PRIMARY answer.

REFACTORED STRUCTURE (40 points):
A passing answer describes:
1. An interface (INotificationChannel or INotifier) with a send(payload) method (15 pts)
2. Concrete implementations per channel (EmailChannel, SmsChannel, etc.) (10 pts)
3. NotificationService accepts channels via constructor injection or a register/map approach,
   replacing all if/else chains with a single channel.send(payload) call (15 pts)

DO NOT PASS if:
- Student names OCP but does not propose an interface or Strategy pattern
- Student only says "put each channel in its own class" without explaining how NotificationService uses them
- Student proposes a Factory Pattern without explaining how it removes the if/else chain
- Student score should be 40-69 if they identify OCP + Strategy but fail to describe the interface or registry mechanism',
'The code violates the Open/Closed Principle. Every time a new notification channel is added (like push notifications), the developer must modify three methods: send(), sendBulk(), and notifyByPreference(). The fix is the Strategy Pattern. First, extract an INotificationChannel interface with a single send(payload: NotificationPayload): Promise<void> method and a channelName string property. Then create concrete classes: EmailChannel, SmsChannel, SlackChannel, PushChannel — each implementing the interface. Finally, refactor NotificationService to hold a Map<string, INotificationChannel> and expose a registerChannel(channel) method. The send() method becomes: const channel = this.channels.get(channelName); await channel.send(payload). Adding push notifications now means creating a PushChannel class and calling service.registerChannel(new PushChannel()) at startup — NotificationService itself is never touched again.',
70
FROM public.problems WHERE slug = 'the-notification-nightmare';
```

---

## PART 22 — 7-DAY SPRINT PLAN

```
DAY 1 — Foundation
  ✅ Create Supabase project, run migration SQL
  ✅ Initialize Next.js 15 project with Tailwind v4
  ✅ Configure Supabase client (client.ts, server.ts, middleware.ts)
  ✅ Implement auth Server Actions (signUp, signIn, signOut)
  ✅ Build login + signup pages
  ✅ Test auth flow end-to-end

DAY 2 — Problem Browser
  ✅ Seed the two sample problems (SQL from Part 21)
  ✅ Build getProblems() Server Action with filters
  ✅ Build /problems page with problem list table
  ✅ Build DifficultyBadge, CategoryTag components
  ✅ Add category + difficulty filter UI

DAY 3 — Problem Detail Page
  ✅ Build getProblemBySlug() Server Action
  ✅ Install and configure Monaco Editor (@monaco-editor/react)
  ✅ Build CodeViewer with tabbed file support
  ✅ Build problem description (ReactMarkdown)
  ✅ Build hint system
  ✅ Build /problems/[slug] page (Server Component shell)

DAY 4 — Submission Flow
  ✅ Build SubmissionForm component
  ✅ Implement submitAnswer() Server Action
  ✅ Build /api/submission-status/[id] poll route
  ✅ Build SubmissionStatus polling component
  ✅ Build SubmissionResult component
  ✅ Wire up the full submission state machine in ProblemDetailClient

DAY 5 — AI Queue + Evaluation
  ✅ Install groq-sdk, set up evaluator-prompt.ts and groq.ts
  ✅ Build /api/process-queue route with claim_next_submission()
  ✅ Create Supabase Edge Function (process-queue/index.ts)
  ✅ Deploy Edge Function: `supabase functions deploy process-queue`
  ✅ Set up pg_cron to call Edge Function every minute
  ✅ Test end-to-end: submit → queue → AI → result

DAY 6 — Solution Viewer + Dashboard
  ✅ Build SolutionViewer (fetches solution files after give-up/solve)
  ✅ Build giveUp() Server Action
  ✅ Build /dashboard page with user stats
  ✅ Build submission history component
  ✅ Build keep-alive route + GitHub Actions workflow

DAY 7 — Polish + Deploy
  ✅ Add 3–4 more problems (use AI to help draft them)
  ✅ Build landing/home page (hero, how it works, problem count)
  ✅ Build basic leaderboard
  ✅ Deploy to Vercel: `vercel deploy --prod`
  ✅ Set environment variables in Vercel Dashboard
  ✅ Set Edge Function secrets in Supabase Dashboard
  ✅ Run smoke test on production URL
  ✅ Post on X/Twitter, Reddit r/programming, r/webdev, Hacker News
```

---

## PART 23 — DEPLOYMENT CHECKLIST

### Vercel
1. Push repo to GitHub
2. Import project in Vercel Dashboard
3. Set all environment variables from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GROQ_API_KEY`
   - `QUEUE_PROCESSOR_SECRET`
   - `NEXT_PUBLIC_APP_URL` = your Vercel URL
4. Deploy

### Supabase
1. Run `supabase/migrations/20240101000000_initial_schema.sql` in SQL editor
2. Run the RLS policies SQL
3. Run the `claim_next_submission` function SQL
4. Run the `pg_cron` schedule SQL (update the URL and key)
5. Deploy Edge Function: `supabase functions deploy process-queue`
6. Set Edge Function secrets:
   - `APP_URL` = your Vercel URL
   - `QUEUE_PROCESSOR_SECRET` = same value as .env.local
7. Enable GitHub OAuth in Auth → Providers
8. Add Vercel URL to Auth → URL Configuration → Redirect URLs

### GitHub
1. Add `APP_URL` to Repository Secrets for the keep-alive workflow

---

## PART 24 — EXTENSIBILITY ROADMAP

### Adding a New Problem Type (Testing Anti-Patterns)
1. Add `testing_antipatterns` to the `problem_category` ENUM (already included)
2. Create problems where the "bad code" files are test files (`.test.ts`)
3. The user's task: identify missing assertions, mock overuse, or coupling issues
4. The rubric: judge whether they identified the specific testing anti-pattern
5. No schema changes needed — the system is already generic

### Adding System Design Problems
1. problem_files will contain text/markdown files describing a system
2. The Monaco editor already supports `markdown` as a language
3. The user submits a text response describing their architecture proposal
4. The rubric assesses: scalability reasoning, correct technology choices, etc.

### Adding a Paid Tier (Future)
1. Add `plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro'))` to profiles
2. Gate problem access: problems with `is_premium = true` require `pro` plan
3. Add Stripe Checkout integration via `/api/checkout` route
4. Use Stripe webhooks to update the profile plan on successful payment
5. Keep the free tier substantial — 15+ problems free ensures organic growth

### Adding a Discussion Forum
1. Create a `comments` table: `(id, submission_id, user_id, content, created_at)`
2. Show community solutions (opt-in) after a user solves a problem
3. Add upvote system for community-verified solutions

---

## GLOSSARY OF KEY DECISIONS

| Decision | Rationale |
|---|---|
| No Redis for queue | Redis adds cost and complexity. pg_cron + `FOR UPDATE SKIP LOCKED` handles 60 req/hour cleanly. |
| Process 1 job/minute | Groq free tier is 14,400 req/day. 1/min = 1,440/day = 10% of limit. Safe headroom. |
| Score threshold 70 | Prevents false negatives while maintaining standards. Configurable per rubric. |
| Monaco read-only | Users analyze code, not write it from scratch. Read-only removes complexity. |
| No React Query | App Router + Server Actions covers data fetching. Polling is simple enough with useEffect. |
| `json_object` response format | Forces Groq to return valid JSON, eliminates parsing failures in 95%+ of cases. |
| Service role in API routes | RLS correctly blocks client access to rubrics. Service role used ONLY in server-side code. |
| ReactMarkdown for feedback | AI feedback is Markdown. Rendering it properly improves UX significantly. |

---

*End of ArchLeet Master Build Specification*
*Document generated: July 2026*
*Stack versions: Next.js 15, Supabase 2.x, Groq SDK 0.5, Tailwind v4*
