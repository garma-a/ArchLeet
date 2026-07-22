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
