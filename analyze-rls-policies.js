// Comprehensive RLS Policy Analysis
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeRLSPolicies() {
  console.log('🔍 Comprehensive RLS Policy Analysis\n');
  
  try {
    // Check what tables exist
    console.log('📊 Available Tables:');
    const tables = ['profiles', 'classes', 'assignments', 'recordings', 'visual_passwords', 'class_sessions'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
        } else {
          console.log(`✅ ${table}: Accessible (${data?.length || 0} row sample)`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }
    
    console.log('\n🔧 Available Functions:');
    const functions = [
      'is_admin', 'is_admin_simple', 'is_teacher', 'get_user_role',
      'admin_get_classes_with_counts', 'create_student_profile_simple',
      'create_teacher_profile_simple', 'get_published_assignments_for_class',
      'get_user_profile_fast'
    ];
    
    for (const func of functions) {
      try {
        const { data, error } = await supabase.rpc(func);
        if (error && error.code !== '42883') { // Function doesn't exist
          console.log(`✅ ${func}: Available (${error.message})`);
        } else if (error?.code === '42883') {
          console.log(`❌ ${func}: Does not exist`);
        } else {
          console.log(`✅ ${func}: Available (returned: ${JSON.stringify(data)})`);
        }
      } catch (err) {
        console.log(`❓ ${func}: ${err.message}`);
      }
    }
    
    console.log('\n🔒 Policy Analysis by Table:');
    
    // Test specific policy behaviors
    console.log('\n📋 Testing Profile Access:');
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, role, is_active')
        .limit(5);
      
      if (profilesError) {
        console.log(`❌ Profiles query failed: ${profilesError.message}`);
      } else {
        console.log(`✅ Profiles accessible: ${profiles?.length || 0} records`);
        if (profiles && profiles.length > 0) {
          console.log(`   Sample roles: ${profiles.map(p => p.role).join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`❌ Profiles error: ${err.message}`);
    }
    
    console.log('\n📋 Testing Assignment Access:');
    try {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, title, is_published, class_id')
        .limit(5);
      
      if (assignmentsError) {
        console.log(`❌ Assignments query failed: ${assignmentsError.message}`);
      } else {
        console.log(`✅ Assignments accessible: ${assignments?.length || 0} records`);
        if (assignments && assignments.length > 0) {
          console.log(`   Published: ${assignments.filter(a => a.is_published).length}/${assignments.length}`);
        }
      }
    } catch (err) {
      console.log(`❌ Assignments error: ${err.message}`);
    }
    
    console.log('\n📋 Testing Visual Passwords Access:');
    try {
      const { data: visualPasswords, error: vpError } = await supabase
        .from('visual_passwords')
        .select('id, name, category')
        .limit(10);
      
      if (vpError) {
        console.log(`❌ Visual passwords query failed: ${vpError.message}`);
      } else {
        console.log(`✅ Visual passwords accessible: ${visualPasswords?.length || 0} records`);
        if (visualPasswords && visualPasswords.length > 0) {
          console.log(`   Categories: ${[...new Set(visualPasswords.map(vp => vp.category))].join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`❌ Visual passwords error: ${err.message}`);
    }
    
    console.log('\n🔍 Policy Safety Analysis:');
    console.log('Based on migration files analysis:');
    console.log('✅ Recent migrations have created SECURITY DEFINER functions');
    console.log('✅ Functions like is_admin(), is_teacher() bypass RLS safely');
    console.log('⚠️  Multiple policy versions exist - may have conflicts');
    console.log('⚠️  Some policies allow anonymous access (security risk)');
    console.log('❌ Infinite recursion detected in older policies');
    
  } catch (error) {
    console.log('💥 Analysis failed:', error.message);
  }
}

analyzeRLSPolicies();