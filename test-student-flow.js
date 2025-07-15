// Test Complete Student Flow
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCompleteStudentFlow() {
  console.log('🧪 Testing complete student flow...');
  
  try {
    // Step 1: Test class access with the specific token
    console.log('\n🏫 Step 1: Testing class access with token 20BB542A...');
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, name, grade_level, access_token')
      .eq('access_token', '20BB542A')
      .eq('is_active', true)
      .single();
    
    if (classError) {
      console.log('❌ Class access failed:', classError.message);
      if (classError.code === 'PGRST116') {
        console.log('🔨 No class found - need to run database/030_fix_student_class_access.sql');
      }
      return;
    }
    
    console.log('✅ Class found:', classData);
    
    // Step 2: Get students in this class
    console.log('\n👥 Step 2: Getting students in class...');
    const { data: students, error: studentsError } = await supabase
      .from('profiles')
      .select('id, full_name, visual_password_id')
      .eq('class_id', classData.id)
      .eq('role', 'student')
      .eq('is_active', true);
    
    if (studentsError) {
      console.log('❌ Students query failed:', studentsError.message);
      return;
    }
    
    console.log('✅ Students found:', students?.length || 0);
    students?.forEach(student => {
      console.log(`  - ${student.full_name} (password: ${student.visual_password_id})`);
    });
    
    // Step 3: Get visual passwords
    console.log('\n🔐 Step 3: Getting visual passwords...');
    const { data: passwords, error: passwordsError } = await supabase
      .from('visual_passwords')
      .select('*')
      .order('category, name');
    
    if (passwordsError) {
      console.log('❌ Visual passwords query failed:', passwordsError.message);
      return;
    }
    
    console.log('✅ Visual passwords found:', passwords?.length || 0);
    const categories = {};
    passwords?.forEach(password => {
      if (!categories[password.category]) categories[password.category] = [];
      categories[password.category].push(`${password.name} (${password.display_emoji || password.id})`);
    });
    
    Object.keys(categories).forEach(category => {
      console.log(`  ${category}: ${categories[category].join(', ')}`);
    });
    
    // Step 4: Test authentication flow (simulate)
    if (students && students.length > 0 && passwords && passwords.length > 0) {
      const testStudent = students[0];
      const studentPassword = passwords.find(p => p.id === testStudent.visual_password_id);
      
      console.log(`\n🎯 Step 4: Simulating login for ${testStudent.full_name}...`);
      console.log(`  Selected password: ${studentPassword?.name || testStudent.visual_password_id}`);
      console.log('✅ Student flow simulation complete!');
      
      console.log('\n🎉 READY TO TEST!');
      console.log('Visit: http://localhost:5173/class/20BB542A');
      console.log(`Try logging in as: ${testStudent.full_name}`);
      console.log(`With password: ${studentPassword?.name || testStudent.visual_password_id}`);
    }
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

testCompleteStudentFlow();