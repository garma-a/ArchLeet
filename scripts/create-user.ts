import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Creating dummy account...');
  
  const email = 'test@archleet.com';
  const password = 'password123';

  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: { name: 'Test User' }
  });

  if (error) {
    if (error.message.includes('already been registered')) {
        console.log(`Account ${email} already exists!`);
    } else {
        console.error('Error creating user:', error.message);
    }
  } else {
    console.log(`Successfully created account:\nEmail: ${email}\nPassword: ${password}`);
  }
}

main().catch(console.error);
