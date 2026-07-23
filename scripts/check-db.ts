import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDb() {
  const { data, error } = await supabase.from('problems').select('id, title, is_published, category');
  console.log('Problems:', data?.length);
  console.log('Error:', error);
  if (data && data.length > 0) {
    console.log('First problem:', data[0]);
  }
}

checkDb();
