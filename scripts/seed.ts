import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We need the service role key to bypass RLS for seeding
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Starting seed process from markdown...');
  
  // Ensure bucket exists
  await supabase.storage.createBucket('problem-files', { public: true }).catch(() => {});
  
  const mdPath = path.join(process.cwd(), 'ARCHLEET_10_OOP_PROBLEMS.md');
  const mdContent = fs.readFileSync(mdPath, 'utf-8');

  // Regex to find problems
  const problemRegex = /## PROBLEM \d+ — "(.*?)"[\s\S]*?\| Slug \| `(.*?)` \|[\s\S]*?\| Difficulty \| (.*?) \|[\s\S]*?\| Category \| `(.*?)`.*?\|[\s\S]*?\| Tags \| `(.*?)`[\s\S]*?### SCENARIO DESCRIPTION[\s\S]*?```markdown\n([\s\S]*?)\n```[\s\S]*?### PROBLEM FILES\n([\s\S]*?)### SOLUTION FILES\n([\s\S]*?)### RUBRIC[\s\S]*?```\n([\s\S]*?)\n```/g;

  let match;
  let orderIndex = 1;

  while ((match = problemRegex.exec(mdContent)) !== null) {
    const title = match[1];
    const slug = match[2];
    const difficulty = match[3].toLowerCase();
    const category = match[4];
    const tags = match[5].split('`, `').map(t => t.replace(/`/g, ''));
    const description = match[6];
    const problemFilesText = match[7];
    const solutionFilesText = match[8];
    const rubricText = match[9];

    console.log(`\nProcessing: ${title} (${slug})`);

    // Insert Problem
    const { error: probError } = await supabase
      .from('problems')
      .upsert({
        slug,
        title,
        difficulty,
        category,
        description,
        hints: [], // Could extract hints if needed
        tags,
        is_published: true,
        order_index: orderIndex++
      }, { onConflict: 'slug' });

    if (probError) {
      console.error(`Error inserting problem ${slug}:`, probError);
      continue;
    }

    // Get the ID (upsert might not return it directly if we don't .select(), let's select it)
    const { data: problem } = await supabase.from('problems').select('id').eq('slug', slug).single();
    if (!problem) continue;

    const problemId = problem.id;

    // Helper to extract and upload files
    const processFiles = async (filesText: string, isSolution: boolean) => {
      const fileRegex = /\*\*File \d+: `(.*?)`\*\*(?: \(solution\))?\n```(?:typescript|ts|javascript|js)\n([\s\S]*?)\n```/g;
      let fileMatch;
      let fileOrder = 0;

      while ((fileMatch = fileRegex.exec(filesText)) !== null) {
        const filename = fileMatch[1];
        const content = fileMatch[2];
        
        const storagePath = `${slug}/${isSolution ? 'solution' : 'problem'}/${filename}`;
        
        console.log(`  Uploading ${storagePath}...`);
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('problem-files')
          .upload(storagePath, content, {
            contentType: 'text/plain',
            upsert: true
          });

        if (uploadError) {
          console.error(`  Error uploading ${storagePath}:`, uploadError);
        }

        // Insert into problem_files table
        const { error: insertError } = await supabase
          .from('problem_files')
          .insert({
            problem_id: problemId,
            filename,
            language: 'typescript',
            storage_path: storagePath,
            file_order: fileOrder++,
            is_solution: isSolution
          });
          
        if (insertError) {
            console.error(`  Error inserting problem_file:`, insertError);
        }
      }
    };

    // Process problem files and solution files
    await processFiles(problemFilesText, false);
    await processFiles(solutionFilesText, true);

    // Insert Rubric
    await supabase
      .from('solution_rubrics')
      .upsert({
        problem_id: problemId,
        rubric_text: rubricText,
        example_correct_answer: '',
        passing_score: 70
      }, { onConflict: 'problem_id' });

    console.log(`✓ Completed ${title}`);
  }

  console.log('\nSeed completed!');
}

main().catch(console.error);
