// Quick setup script to create storage bucket and table
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// You'll need to set these environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key needed for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupRecordingStorage() {
  console.log('Setting up recording storage...');

  try {
    // 1. Create storage bucket
    console.log('Creating storage bucket...');
    const { data: bucket, error: bucketError } = await supabase.storage
      .createBucket('student-recordings', {
        public: false,
        allowedMimeTypes: ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/webm'],
        fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
      });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('Error creating bucket:', bucketError);
    } else {
      console.log('✅ Storage bucket created/exists');
    }

    // 2. Run table migration
    console.log('Creating recording_submissions table...');
    const tableSql = fs.readFileSync(
      path.join(process.cwd(), 'database/migrations/create_recording_submissions_table.sql'),
      'utf8'
    );
    
    const { error: tableError } = await supabase.rpc('exec_sql', { sql: tableSql });
    if (tableError) {
      console.error('Error creating table:', tableError);
    } else {
      console.log('✅ Table created');
    }

    // 3. Set up storage policies
    console.log('Setting up storage policies...');
    const policySql = fs.readFileSync(
      path.join(process.cwd(), 'database/migrations/create_storage_policies.sql'),
      'utf8'
    );
    
    const { error: policyError } = await supabase.rpc('exec_sql', { sql: policySql });
    if (policyError) {
      console.error('Error creating policies:', policyError);
    } else {
      console.log('✅ Storage policies created');
    }

    console.log('\n🎉 Recording storage setup complete!');
    console.log('\nNext steps:');
    console.log('1. Test recording upload in the app');
    console.log('2. Check Supabase Storage dashboard to see uploaded files');
    console.log('3. Verify recordings appear in recording_submissions table');

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupRecordingStorage();