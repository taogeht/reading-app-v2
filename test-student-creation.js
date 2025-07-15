// Test Student Creation Fix
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStudentCreation() {
  console.log('🧪 Testing student creation fix...');
  
  try {
    // Check if the new function exists
    console.log('📋 Testing create_student_profile_no_auth function...');
    
    // First get a class to use for testing
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);
    
    if (classError || !classes || classes.length === 0) {
      console.log('❌ No active classes found:', classError?.message);
      return;
    }
    
    const testClass = classes[0];
    console.log('🏫 Using class for test:', testClass.name);
    
    // Test the function
    const testStudentEmail = `test.student.${Date.now()}@example.com`;
    const testStudentName = `Test Student ${Date.now()}`;
    
    console.log('👤 Creating test student:', testStudentName);
    
    const { data: studentResult, error: studentError } = await supabase.rpc('create_student_profile_no_auth', {
      student_email: testStudentEmail,
      student_name: testStudentName,
      student_class_id: testClass.id,
      visual_password_id: null
    });
    
    if (studentError) {
      console.log('❌ Student creation failed:', studentError.message);
      console.log('📋 Error details:', studentError);
      
      if (studentError.message.includes('does not exist')) {
        console.log('🔨 Function does not exist - need to run database/028_fix_student_creation.sql');
      }
    } else {
      console.log('✅ Student creation worked! Student ID:', studentResult);
      
      // Verify the student was created
      const { data: studentCheck, error: checkError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, class_id')
        .eq('id', studentResult)
        .single();
      
      if (!checkError && studentCheck) {
        console.log('✅ Student verified in database:', studentCheck);
        
        // Clean up test student
        const { error: deleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', studentResult);
        
        if (!deleteError) {
          console.log('🧹 Test student cleaned up');
        }
      }
    }
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

testStudentCreation();