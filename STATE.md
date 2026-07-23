# ArchLeet - Current Project State

This document summarizes the current state of the ArchLeet project, what has been implemented so far, and what remains to be done. It is designed to get any new LLM session quickly up to speed.

## 🟢 Completed So Far

### 1. Project Initialization & Dependencies
- **Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS.
- **Dependencies**: `@supabase/ssr`, `@supabase/supabase-js`, `@monaco-editor/react`, `react-markdown`, `lucide-react`, `remark-gfm`, `dotenv`, `tsx`.
- The project builds and compiles without any TypeScript or linting errors.

### 2. Database & Supabase Integration
- Connected to a remote Supabase project.
- **Schema Migrations**:
  - `20240101000000_schema.sql`: Basic schema containing `profiles`, `problems`, `user_progress`, and `submissions`.
  - `20240101000002_use_storage_for_files.sql`: Updated the schema to use Supabase Storage buckets for code files instead of string content inside PostgreSQL.
- **Storage**: Created the `problem-files` bucket with public read access.

### 3. Data Seeding
- Created and executed a robust data seeding script (`scripts/seed.ts`).
- **Data loaded**: 10 High-Quality OOP Architecture Problems (parsed from `ARCHLEET_10_OOP_PROBLEMS.md`).
- Code files for each problem were successfully uploaded to Supabase Storage, and database records correctly point to these paths (`storage_path`).

### 4. Authentication (Day 1)
- Implemented Supabase SSR Auth with properly typed `server.ts`, `client.ts`, and `middleware.ts`.
- Built Login (`/login`) and Signup (`/signup`) pages handling Email/Password and GitHub OAuth.
- Created `src/actions/auth.ts` server actions.
- Protected `/(main)` routes using `middleware.ts`.

### 5. Dashboard & Problems List (Day 2)
- Implemented `/problems` listing page (`src/app/(main)/problems/page.tsx`).
- Created a Navigation Sidebar (`src/components/layout/Sidebar.tsx`).
- Created server actions (`src/actions/problems.ts`) to retrieve problems and join them with `user_progress` for "Solved" / "Attempts" indicators.

### 6. Problem Detail & Submission UI (Day 3)
- Implemented the Main Problem Solving Interface at `/problems/[slug]`.
- Component `ProblemDetailClient.tsx` manages a robust state machine (`idle` → `polling` → `result` → `solution`).
- Implemented `CodeViewer` using Monaco Editor to display architecture challenges gracefully.
- Implemented `SubmissionForm`, `SubmissionStatus` (with a 3-second polling interval), and `SubmissionResult`.
- Created Server Actions in `src/actions/submissions.ts` to `submitAnswer`, `giveUp`, and `getSubmissionHistory`.
- Created API route `app/api/submission-status/[id]/route.ts` to expose the polling endpoint for the UI.
- All code handles Next.js 15 breaking changes (e.g., treating route `params` as Promises).

---

## 🟡 What's Next (Pending)

### AI Evaluation Engine & Background Queue (Day 4)
The UI is fully functional and successfully inserts submissions into the database with `status = 'pending'`. The missing piece is the background worker that actually evaluates these submissions.

1. **Prompt Builder**: Needs to be implemented (`src/lib/evaluator-prompt.ts`) to construct the system prompt containing the problem description, code context, rubric, and user answer.
2. **Groq Integration**: Need to integrate `groq-sdk` to send the built prompt to an LLM (e.g., `llama3-70b-8192`) and request a strict JSON output (`{ is_correct, score, feedback }`).
3. **Queue Processor**: Needs a background worker script (e.g., `scripts/queue-worker.ts`) that runs continuously (via a cron job, a `setInterval` script, or similar). This worker should:
   - Find submissions with `status = 'pending'`.
   - Fetch the associated problem and rubric.
   - Call the LLM.
   - Update the submission `status` to `completed` or `failed` along with `is_correct`, `ai_score`, and `ai_feedback`.

**To resume work, ask the LLM to**: 
*"Start implementing the AI Evaluation Queue and the Groq LLM processor (Part 15 and 16 of the PLAN.md)"*
