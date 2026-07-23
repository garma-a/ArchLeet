-- Enable RLS on core tables
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_files ENABLE ROW LEVEL SECURITY;

-- Grant permissions to roles just in case
GRANT SELECT ON public.problems TO anon, authenticated;
GRANT SELECT ON public.problem_files TO anon, authenticated;

-- Policy: Everyone can view published problems
CREATE POLICY "Published problems are viewable by everyone" 
ON public.problems FOR SELECT 
USING (is_published = true);

-- Policy: Everyone can view problem files (the bad code)
CREATE POLICY "Problem files are viewable by everyone" 
ON public.problem_files FOR SELECT 
USING (is_solution = false);

-- Policy: Solutions are viewable by authenticated users (or you can add a check for solved later)
CREATE POLICY "Solutions are viewable by authenticated" 
ON public.problem_files FOR SELECT 
USING (is_solution = true AND auth.role() = 'authenticated');
