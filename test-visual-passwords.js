// Test Visual Passwords and Class Access
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testVisualPasswordFlow() {
  console.log('🧪 Testing visual password system...');
  
  try {
    // Test visual passwords table
    console.log('\n📋 Checking visual passwords...');
    const { data: passwords, error: passwordError } = await supabase
      .from('visual_passwords')
      .select('*')
      .limit(5);
    
    if (passwordError) {
      console.log('❌ Visual passwords error:', passwordError.message);
      console.log('🔨 Need to create visual_passwords table and seed data');
    } else {
      console.log('✅ Visual passwords found:', passwords?.length || 0);
      if (passwords && passwords.length > 0) {
        console.log('Sample password:', passwords[0]);
      }
    }
    
    // Test class access with a dummy token
    console.log('\n🏫 Testing class access...');
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('access_token', '20BB542A')
      .single();
    
    if (classError) {
      console.log('❌ Class access error:', classError.message);
      if (classError.code === 'PGRST116') {
        console.log('🔨 No class found with token 20BB542A - need to create/update class with this token');
      }
    } else {
      console.log('✅ Class found:', classes);
    }
    
    // Test students in a class
    console.log('\n👥 Testing students...');
    const { data: students, error: studentsError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .limit(3);
    
    if (studentsError) {
      console.log('❌ Students error:', studentsError.message);
    } else {
      console.log('✅ Students found:', students?.length || 0);
      if (students && students.length > 0) {
        console.log('Sample student:', students[0]);
      }
    }
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

testVisualPasswordFlow();