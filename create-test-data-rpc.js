// Create Test Data Using RPC Functions
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestDataViaRPC() {
  console.log('🏗️  Creating test data using admin RPC functions...');
  
  try {
    // Step 1: Create a test class using admin function
    console.log('\n🏫 Step 1: Creating test class via admin function...');
    
    // First, check if any teacher exists
    const { data: existingTeachers } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'teacher')
      .limit(1);
    
    let teacherId;
    if (existingTeachers && existingTeachers.length > 0) {
      teacherId = existingTeachers[0].id;
      console.log('✅ Using existing teacher ID:', teacherId);
    } else {
      // Create a dummy teacher ID (the function might create it or we'll handle the error)
      teacherId = crypto.randomUUID();
      console.log('⚠️  No teachers found, using dummy ID:', teacherId);
    }
    
    // Try to create class using admin function
    const { data: classResult, error: classError } = await supabase.rpc('admin_create_class', {
      class_name: 'Test Reading Class',
      class_grade_level: 2,
      class_teacher_id: teacherId,
      class_school_year: '2024-2025',
      class_description: 'Test class for visual password login',
      class_max_students: 25
    });
    
    if (classError) {
      console.log('❌ Failed to create class via admin function:', classError.message);
      
      if (classError.message.includes('Only admins')) {
        console.log('🔑 Need to be logged in as admin to create test data');
        console.log('📋 Manual steps needed:');
        console.log('   1. Sign in to admin dashboard');
        console.log('   2. Create a teacher');
        console.log('   3. Create a class with access token "20BB542A"');
        console.log('   4. Add students to the class with visual passwords');
        return;
      }
      return;
    }
    
    console.log('✅ Class created with ID:', classResult);
    
    // Step 2: Try to create students using admin function  
    console.log('\n👥 Step 2: Creating test students...');
    
    const students = [
      { name: 'Emma Johnson', email: 'emma.test@school.edu', password: 'cat' },
      { name: 'Alex Martinez', email: 'alex.test@school.edu', password: 'dog' },
      { name: 'Sam Wilson', email: 'sam.test@school.edu', password: 'red' }
    ];
    
    for (const student of students) {
      const { data: studentResult, error: studentError } = await supabase.rpc('create_student_profile_simple', {
        student_email: student.email,
        student_name: student.name,
        student_class_id: classResult,
        visual_password_id: student.password
      });
      
      if (studentError) {
        console.log(`❌ Failed to create student ${student.name}:`, studentError.message);
      } else {
        console.log(`✅ Student created: ${student.name} (password: ${student.password})`);
      }
    }
    
    // Step 3: Update the class to have the correct access token
    console.log('\n🔧 Step 3: Setting access token to 20BB542A...');
    
    const { error: updateError } = await supabase
      .from('classes')
      .update({ access_token: '20BB542A' })
      .eq('id', classResult);
    
    if (updateError) {
      console.log('❌ Failed to update access token:', updateError.message);
    } else {
      console.log('✅ Access token set to 20BB542A');
    }
    
    console.log('\n🎉 TEST DATA CREATION COMPLETE!');
    console.log('🔗 Visit: http://localhost:5173/class/20BB542A');
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

createTestDataViaRPC();