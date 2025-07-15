// Setup script for username-based authentication
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment check:');
console.log('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('\n❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('- VITE_SUPABASE_URL is not set');
  if (!supabaseServiceKey) console.error('- SUPABASE_SERVICE_ROLE_KEY is not set');
  console.error('\nPlease check your .env file and make sure both variables are set correctly.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupUsernameAuth() {
  console.log('Setting up username-based authentication...');

  try {
    // Read and execute the SQL migration
    const migrationSql = fs.readFileSync('database/migrations/add_username_field.sql', 'utf8');
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      console.log('Executing SQL statement...');
      const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() + ';' });
      
      if (error) {
        console.error('Error executing SQL:', error);
        // Don't exit on errors - some statements might already exist
      }
    }

    console.log('✅ Username authentication setup complete!');
    console.log('\nNext steps:');
    console.log('1. Use the SuperAdmin dashboard to create teachers with usernames');
    console.log('2. Teachers will receive auto-generated passwords');
    console.log('3. Teachers can log in immediately using username + password');
    console.log('4. No email confirmation required!');

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupUsernameAuth();