// Add archived column to recording_submissions table
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Supabase configuration
const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTY0MjE3OCwiZXhwIjoyMDU3MjE4MTc4fQ.Sw_CKJaLnCoSlKkyV4aVviSthXytDhKhrVNkM7SyI8k';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addArchivedColumn() {
  console.log('🔧 Adding archived column to recording_submissions table...');
  
  try {
    // Read and execute the migration SQL
    const migrationSQL = fs.readFileSync('database/036_add_archived_column.sql', 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      const cleanStatement = statement.trim();
      if (cleanStatement && !cleanStatement.startsWith('--') && !cleanStatement.startsWith('COMMENT')) {
        console.log('📝 Executing:', cleanStatement.substring(0, 50) + '...');
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: cleanStatement 
        });
        
        if (error) {
          console.log('❌ Error executing statement:', error.message);
          console.log('🔍 Statement:', cleanStatement);
          
          // Try direct SQL execution if exec_sql doesn't work
          if (error.message.includes('does not exist')) {
            console.log('🔄 Trying direct execution...');
            const { error: directError } = await supabase.from('recording_submissions').select('archived').limit(1);
            if (directError && directError.message.includes('does not exist')) {
              console.log('✅ Column needs to be added - this is expected');
            }
          }
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }
    
    // Test if the column was added successfully
    console.log('🧪 Testing if archived column exists...');
    const { data, error } = await supabase
      .from('recording_submissions')
      .select('id, archived')
      .limit(1);
    
    if (error) {
      console.log('❌ Column test failed:', error.message);
    } else {
      console.log('✅ Archived column exists and is accessible!');
      console.log('📊 Sample data:', data);
    }
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

// Run the migration
addArchivedColumn();