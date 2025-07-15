// Debug RLS Policies for Classes Table
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRLSPolicies() {
  console.log('🔍 Debugging RLS policies for classes table...');
  
  try {
    // Test 1: Check if any classes exist at all
    console.log('\n📋 Test 1: Basic SELECT without conditions...');
    const { data: basicData, error: basicError } = await supabase
      .from('classes')
      .select('*');
    
    if (basicError) {
      console.log('❌ Basic SELECT failed:', basicError.message);
    } else {
      console.log('✅ Basic SELECT succeeded, found', basicData?.length || 0, 'classes');
      if (basicData && basicData.length > 0) {
        console.log('📊 Available access tokens:', basicData.map(c => c.access_token));
      }
    }
    
    // Test 2: Test specific access token query
    console.log('\n📋 Test 2: Query for specific access token 912FD3EC...');
    const { data: tokenData, error: tokenError } = await supabase
      .from('classes')
      .select('id, name, access_token, is_active')
      .eq('access_token', '912FD3EC');
    
    if (tokenError) {
      console.log('❌ Token query failed:', tokenError.message);
    } else {
      console.log('✅ Token query succeeded, found', tokenData?.length || 0, 'classes');
      if (tokenData && tokenData.length > 0) {
        console.log('📊 Found class:', tokenData[0]);
      }
    }
    
    // Test 3: Test with is_active condition
    console.log('\n📋 Test 3: Query with is_active condition...');
    const { data: activeData, error: activeError } = await supabase
      .from('classes')
      .select('id, name, access_token, is_active')
      .eq('access_token', '912FD3EC')
      .eq('is_active', true);
    
    if (activeError) {
      console.log('❌ Active query failed:', activeError.message);
    } else {
      console.log('✅ Active query succeeded, found', activeData?.length || 0, 'classes');
    }
    
    // Test 4: Test with .single() - this is what's failing
    console.log('\n📋 Test 4: Query with .single() (this is what fails)...');
    const { data: singleData, error: singleError } = await supabase
      .from('classes')
      .select('id, name, grade_level, access_token')
      .eq('access_token', '912FD3EC')
      .eq('is_active', true)
      .single();
    
    if (singleError) {
      console.log('❌ Single query failed:', singleError.message);
      console.log('📋 Error code:', singleError.code);
      
      if (singleError.code === 'PGRST116') {
        console.log('🔍 This means either:');
        console.log('   1. No rows match the criteria');
        console.log('   2. RLS policy is blocking the query');
        console.log('   3. The class exists but is_active is false');
      }
    } else {
      console.log('✅ Single query succeeded:', singleData);
    }
    
    // Test 5: Check current auth status
    console.log('\n📋 Test 5: Check current auth status...');
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 Current user:', user?.email || 'Anonymous');
    
    // Test 6: Test admin functions
    console.log('\n📋 Test 6: Test admin status...');
    const { data: adminCheck, error: adminError } = await supabase.rpc('is_admin_simple');
    
    if (adminError) {
      console.log('❌ Admin check failed:', adminError.message);
    } else {
      console.log('🔑 Admin status:', adminCheck);
    }
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

debugRLSPolicies();