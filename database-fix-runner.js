// Database Fix Runner - Execute SQL scripts through Supabase client
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read environment variables
const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaGFkem5yYnVlaXRzZm1pcnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDIxNzgsImV4cCI6MjA1NzIxODE3OH0.MALZ4YcGbw3_Wl6X5w1xlcpeLung82lj9TYvoxAtUT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDatabaseFix() {
  console.log('🔧 Running database fix for admin_create_class...');
  
  try {
    // Test current admin status
    console.log('📋 Testing admin access...');
    const { data: adminCheck, error: adminError } = await supabase.rpc('is_admin_simple');
    
    if (adminError) {
      console.log('⚠️  Admin check failed:', adminError.message);
    } else {
      console.log('✅ Admin status:', adminCheck);
    }
    
    // Test if admin_create_class function exists and works
    console.log('🧪 Testing admin_create_class function...');
    
    // First, get a teacher ID for testing
    const { data: teachers, error: teachersError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'teacher')
      .eq('is_active', true)
      .limit(1);
    
    if (teachersError) {
      console.log('❌ Failed to get teachers:', teachersError.message);
      return;
    }
    
    if (!teachers || teachers.length === 0) {
      console.log('⚠️  No active teachers found - cannot test class creation');
      return;
    }
    
    const testTeacher = teachers[0];
    console.log('👨‍🏫 Using teacher for test:', testTeacher.full_name);
    
    // Try to create a test class
    const testClassName = `Test Class ${Date.now()}`;
    console.log('🏫 Creating test class:', testClassName);
    
    const { data: classResult, error: classError } = await supabase.rpc('admin_create_class', {
      class_name: testClassName,
      class_grade_level: 1,
      class_teacher_id: testTeacher.id,
      class_school_year: '2024-2025',
      class_description: 'Test class created by database fix runner',
      class_max_students: 25
    });
    
    if (classError) {
      console.log('❌ admin_create_class failed:', classError.message);
      console.log('📋 Error details:', classError);
      
      // If function doesn't exist, we need to create it
      if (classError.message.includes('function') && classError.message.includes('does not exist')) {
        console.log('🔨 Function does not exist - need to run SQL script manually');
        console.log('📝 Please run database/027_fix_admin_create_class.sql in your Supabase SQL editor');
      }
    } else {
      console.log('✅ admin_create_class worked! Created class ID:', classResult);
      
      // Clean up test class
      console.log('🧹 Cleaning up test class...');
      const { error: deleteError } = await supabase
        .from('classes')
        .delete()
        .eq('id', classResult);
      
      if (!deleteError) {
        console.log('✅ Test class cleaned up successfully');
      }
    }
    
    // Test class fetching
    console.log('📚 Testing class fetching...');
    const { data: classes, error: fetchError } = await supabase.rpc('admin_get_classes_with_counts');
    
    if (fetchError) {
      console.log('❌ admin_get_classes_with_counts failed:', fetchError.message);
    } else {
      console.log('✅ admin_get_classes_with_counts works! Found', classes?.length || 0, 'classes');
    }
    
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

// Run the fix
runDatabaseFix();