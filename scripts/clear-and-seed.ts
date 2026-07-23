import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Clearing old problem files...');
  
  // Get all problems to safely delete files
  const { data: problems } = await supabase.from('problems').select('id');
  
  if (problems && problems.length > 0) {
    const ids = problems.map(p => p.id);
    const { error } = await supabase.from('problem_files').delete().in('problem_id', ids);
    if (error) console.error('Error clearing problem files:', error);
    else console.log('Successfully cleared problem files.');
  }

  console.log('Running seed script to re-add files correctly...');
  execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
}

main().catch(console.error);
