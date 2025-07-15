// Debug Classes Table Structure
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugClassesTable() {
  console.log('🔍 Debugging classes table...');
  
  try {
    // Test 1: Simple select to see if table exists and has data
    console.log('\n📋 Test 1: Basic table access...');
    const { data: basicData, error: basicError } = await supabase
      .from('classes')
      .select('*')
      .limit(1);
    
    if (basicError) {
      console.log('❌ Basic table access failed:', basicError.message);
      if (basicError.code === 'PGRST116') {
        console.log('📝 Table exists but is empty');
      }
    } else {
      console.log('✅ Table accessible, rows:', basicData?.length || 0);
      if (basicData && basicData.length > 0) {
        console.log('📊 Sample row columns:', Object.keys(basicData[0]));
      }
    }
    
    // Test 2: Try different column combinations
    console.log('\n📋 Test 2: Testing column access...');
    
    const columnTests = [
      ['id'],
      ['id', 'name'],
      ['id', 'name', 'grade_level'],
      ['id', 'name', 'grade_level', 'access_token'],
      ['id', 'name', 'grade_level', 'access_token', 'is_active']
    ];
    
    for (const columns of columnTests) {
      const { error } = await supabase
        .from('classes')
        .select(columns.join(', '))
        .limit(1);
      
      if (error) {
        console.log(`❌ Columns [${columns.join(', ')}]:`, error.message);
      } else {
        console.log(`✅ Columns [${columns.join(', ')}]: OK`);
      }
    }
    
    // Test 3: Check RLS policies
    console.log('\n📋 Test 3: Testing with conditions...');
    
    const { data: conditionData, error: conditionError } = await supabase
      .from('classes')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);
    
    if (conditionError) {
      console.log('❌ Condition test failed:', conditionError.message);
    } else {
      console.log('✅ Condition test passed, rows:', conditionData?.length || 0);
    }
    
    // Test 4: Try to insert a test class (will fail if RLS blocks, but tells us why)
    console.log('\n📋 Test 4: Testing insert (expected to fail with RLS)...');
    
    const { error: insertError } = await supabase
      .from('classes')
      .insert({
        name: 'Test Insert',
        grade_level: 1,
        teacher_id: crypto.randomUUID(),
        access_token: 'TEST123',
        is_active: true
      });
    
    if (insertError) {
      console.log('❌ Insert failed (expected):', insertError.message);
      if (insertError.message.includes('policy')) {
        console.log('🔒 RLS is active - need admin access to create classes');
      }
    } else {
      console.log('✅ Insert succeeded (unexpected!)');
    }
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

debugClassesTable();