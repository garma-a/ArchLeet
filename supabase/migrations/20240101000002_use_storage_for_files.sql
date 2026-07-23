-- Create a public bucket for problem files
INSERT INTO storage.buckets (id, name, public)
VALUES ('problem-files', 'problem-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to read files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'problem-files' );

-- Update the problem_files table
ALTER TABLE public.problem_files
DROP COLUMN IF EXISTS content,
ADD COLUMN IF NOT EXISTS storage_path TEXT NOT NULL DEFAULT '';
