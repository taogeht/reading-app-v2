// Create Test Data for Visual Password Flow
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestData() {
  console.log('🏗️  Creating test data for visual password flow...');
  
  try {
    // Step 1: Create a teacher first (needed for class)
    console.log('\n👨‍🏫 Step 1: Creating test teacher...');
    const teacherId = crypto.randomUUID();
    
    const { error: teacherError } = await supabase
      .from('profiles')
      .insert({
        id: teacherId,
        email: 'teacher.test@school.edu',
        full_name: 'Ms. Johnson',
        role: 'teacher',
        is_active: true
      });
    
    if (teacherError && !teacherError.message.includes('duplicate')) {
      console.log('❌ Failed to create teacher:', teacherError.message);
      return;
    }
    console.log('✅ Teacher created/exists');
    
    // Step 2: Create test class
    console.log('\n🏫 Step 2: Creating test class...');
    const classId = crypto.randomUUID();
    
    const { error: classError } = await supabase
      .from('classes')
      .insert({
        id: classId,
        name: 'Test Reading Class',
        grade_level: 2,
        teacher_id: teacherId,
        access_token: '20BB542A',
        is_active: true,
        school_year: '2024-2025',
        description: 'Test class for visual password login',
        max_students: 25
      });
    
    if (classError && !classError.message.includes('duplicate')) {
      console.log('❌ Failed to create class:', classError.message);
      return;
    }
    console.log('✅ Class created/exists');
    
    // Step 3: Create test students
    console.log('\n👥 Step 3: Creating test students...');
    
    const students = [
      { name: 'Emma Johnson', email: 'emma.test@school.edu', password: 'cat' },
      { name: 'Alex Martinez', email: 'alex.test@school.edu', password: 'dog' },
      { name: 'Sam Wilson', email: 'sam.test@school.edu', password: 'red' }
    ];
    
    for (const student of students) {
      const studentId = crypto.randomUUID();
      const { error: studentError } = await supabase
        .from('profiles')
        .insert({
          id: studentId,
          email: student.email,
          full_name: student.name,
          role: 'student',
          class_id: classId,
          visual_password_id: student.password,
          is_active: true
        });
      
      if (studentError && !studentError.message.includes('duplicate')) {
        console.log(`❌ Failed to create student ${student.name}:`, studentError.message);
      } else {
        console.log(`✅ Student created: ${student.name} (password: ${student.password})`);
      }
    }
    
    // Step 4: Test the complete flow
    console.log('\n🎯 Step 4: Testing complete flow...');
    
    // Test class access
    const { data: classData, error: testClassError } = await supabase
      .from('classes')
      .select('id, name, grade_level, access_token')
      .eq('access_token', '20BB542A')
      .eq('is_active', true)
      .single();
    
    if (testClassError) {
      console.log('❌ Class test failed:', testClassError.message);
      return;
    }
    
    console.log('✅ Class access test passed:', classData.name);
    
    // Test students
    const { data: studentsData, error: testStudentsError } = await supabase
      .from('profiles')
      .select('id, full_name, visual_password_id')
      .eq('class_id', classData.id)
      .eq('role', 'student');
    
    if (testStudentsError) {
      console.log('❌ Students test failed:', testStudentsError.message);
      return;
    }
    
    console.log('✅ Students test passed:', studentsData?.length || 0, 'students found');
    
    // Test visual passwords
    const { data: passwordsData, error: testPasswordsError } = await supabase
      .from('visual_passwords')
      .select('*')
      .limit(3);
    
    if (testPasswordsError) {
      console.log('❌ Visual passwords test failed:', testPasswordsError.message);
      return;
    }
    
    console.log('✅ Visual passwords test passed:', passwordsData?.length || 0, 'passwords found');
    
    console.log('\n🎉 TEST DATA CREATION COMPLETE!');
    console.log('🔗 Visit: http://localhost:5173/class/20BB542A');
    console.log('👥 Available students:');
    studentsData?.forEach(student => {
      console.log(`   - ${student.full_name} (password: ${student.visual_password_id})`);
    });
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

createTestData();