// Database Debug - Check current state
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDatabase() {
  console.log('🔍 Debugging database state...');
  
  // Check current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log('👤 Current user:', user?.email || 'Not logged in');
  
  // Check if functions exist by trying to call them
  console.log('\n📋 Testing function existence...');
  
  // Test is_admin_simple
  try {
    const { data, error } = await supabase.rpc('is_admin_simple');
    console.log('✅ is_admin_simple exists, result:', data, error ? `Error: ${error.message}` : '');
  } catch (e) {
    console.log('❌ is_admin_simple failed:', e.message);
  }
  
  // Test admin_create_class with minimal params to see if it exists
  try {
    const { data, error } = await supabase.rpc('admin_create_class', {
      class_name: 'test',
      class_grade_level: 1,
      class_teacher_id: '00000000-0000-0000-0000-000000000000' // Dummy UUID
    });
    console.log('✅ admin_create_class exists, result:', data, error ? `Error: ${error.message}` : '');
  } catch (e) {
    console.log('❌ admin_create_class failed:', e.message);
  }
  
  // Check profiles table
  console.log('\n👥 Checking profiles table...');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, count(*)')
      .single();
    console.log('📊 Profiles query result:', data, error ? `Error: ${error.message}` : '');
  } catch (e) {
    console.log('❌ Profiles query failed:', e.message);
  }
  
  // Check classes table
  console.log('\n🏫 Checking classes table...');
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .limit(1);
    console.log('📊 Classes query result:', data?.length || 0, 'rows', error ? `Error: ${error.message}` : '');
  } catch (e) {
    console.log('❌ Classes query failed:', e.message);
  }
  
  // Test admin_get_classes_with_counts
  console.log('\n📚 Testing admin_get_classes_with_counts...');
  try {
    const { data, error } = await supabase.rpc('admin_get_classes_with_counts');
    console.log('✅ admin_get_classes_with_counts exists, result:', data?.length || 0, 'classes', error ? `Error: ${error.message}` : '');
  } catch (e) {
    console.log('❌ admin_get_classes_with_counts failed:', e.message);
  }
}

debugDatabase();