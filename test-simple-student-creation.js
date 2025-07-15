// Test Simple Student Creation Fix
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSimpleStudentCreation() {
  console.log('🧪 Testing simple student creation fix...');
  
  try {
    // Test the simple function
    console.log('📋 Testing create_student_profile_simple function...');
    
    const { data: result, error } = await supabase.rpc('create_student_profile_simple', {
      student_email: 'test@example.com',
      student_name: 'Test Student',
      student_class_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      visual_password_id: null
    });
    
    if (error) {
      console.log('Error details:', error);
      
      if (error.message.includes('does not exist')) {
        console.log('🔨 Function does not exist - need to run database/029_fix_student_creation_simple.sql');
      } else if (error.message.includes('Invalid or inactive class ID')) {
        console.log('✅ Function exists and validates class ID correctly!');
      } else if (error.message.includes('Only admins can create students')) {
        console.log('✅ Function exists and enforces admin access correctly!');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    } else {
      console.log('✅ Function call succeeded:', result);
    }
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

testSimpleStudentCreation();