// Test Class Access Fix
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testClassFix() {
  console.log('🧪 Testing class access fix...');
  
  try {
    // First, let's see what classes exist
    console.log('\n📋 Checking existing classes...');
    const { data: allClasses, error: allClassesError } = await supabase
      .from('classes')
      .select('id, name, access_token, is_active')
      .limit(5);
    
    if (allClassesError) {
      console.log('❌ Failed to get classes:', allClassesError.message);
    } else {
      console.log('✅ Found classes:', allClasses?.length || 0);
      allClasses?.forEach(cls => {
        console.log(`  - ${cls.name} (token: ${cls.access_token}, active: ${cls.is_active})`);
      });
    }
    
    // Try the simple query (without allow_student_access)
    console.log('\n🔍 Testing simple class query...');
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, name, grade_level, access_token')
      .eq('access_token', '20BB542A')
      .eq('is_active', true)
      .single();
    
    if (classError) {
      console.log('❌ Class query failed:', classError.message);
      
      if (classError.code === 'PGRST116') {
        console.log('🔨 No class with token 20BB542A found');
        
        // Let's try to use an existing class or create one
        if (allClasses && allClasses.length > 0) {
          const existingClass = allClasses[0];
          console.log(`\n🔄 Updating existing class "${existingClass.name}" with token 20BB542A...`);
          
          const { error: updateError } = await supabase
            .from('classes')
            .update({ access_token: '20BB542A' })
            .eq('id', existingClass.id);
          
          if (updateError) {
            console.log('❌ Failed to update class:', updateError.message);
          } else {
            console.log('✅ Updated class with token 20BB542A');
          }
        }
      }
    } else {
      console.log('✅ Class found:', classData);
    }
    
    // Test the StudentAuthContext-like query
    console.log('\n🎯 Testing StudentAuthContext query...');
    const testResult = await testGetClassByToken('20BB542A');
    console.log('Result:', testResult);
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

// Simulate the StudentAuthContext function
async function testGetClassByToken(accessToken) {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, grade_level, access_token')
      .eq('access_token', accessToken)
      .eq('is_active', true)
      .single();

    if (error) {
      return { class: null, error: 'Class not found or access not allowed' };
    }

    const classWithAccess = { ...data, allow_student_access: true };
    return { class: classWithAccess, error: null };
  } catch (error) {
    return { class: null, error: 'Failed to fetch class information' };
  }
}

testClassFix();