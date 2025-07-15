// Check Database State
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkState() {
  console.log('🔍 Checking database state...');
  
  // Check current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log('👤 Current user:', user?.email || 'Not logged in');
  
  // Check classes
  console.log('\n🏫 Checking classes...');
  const { data: classes, error: classError } = await supabase
    .from('classes')
    .select('*');
  
  console.log('Classes result:', classes?.length || 0, 'classes found', classError ? `Error: ${classError.message}` : '');
  if (classes && classes.length > 0) {
    console.log('Sample class:', classes[0]);
  }
  
  // Check profiles  
  console.log('\n👥 Checking profiles...');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .limit(5);
  
  console.log('Profiles result:', profiles?.length || 0, 'profiles found', profileError ? `Error: ${profileError.message}` : '');
  
  // Check functions
  console.log('\n🔧 Testing functions...');
  
  // Test create_student_profile_no_auth function
  try {
    const { data, error } = await supabase.rpc('create_student_profile_no_auth', {
      student_email: 'test@test.com',
      student_name: 'Test',
      student_class_id: '00000000-0000-0000-0000-000000000000'
    });
    console.log('create_student_profile_no_auth:', error ? `Error: ${error.message}` : 'Function exists');
  } catch (e) {
    console.log('create_student_profile_no_auth: Failed -', e.message);
  }
}

checkState();