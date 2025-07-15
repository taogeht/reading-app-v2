// Simple script to add username column to profiles table
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment check:');
console.log('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('\n❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addUsernameColumn() {
  console.log('Adding username column to profiles table...');

  try {
    // Add username column
    const { error: columnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;'
    });

    if (columnError) {
      console.error('Error adding username column:', columnError);
      console.log('\nYou can manually run this SQL in Supabase Dashboard:');
      console.log('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;');
      return;
    }

    // Add index
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);'
    });

    if (indexError) {
      console.warn('Warning: Could not create index:', indexError);
    }

    console.log('✅ Username column added successfully!');
    console.log('\nNow you can create teachers with usernames in the SuperAdmin dashboard.');

  } catch (error) {
    console.error('Setup failed:', error);
    console.log('\nFallback: Run this SQL manually in your Supabase Dashboard:');
    console.log('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;');
    console.log('CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);');
  }
}

addUsernameColumn();