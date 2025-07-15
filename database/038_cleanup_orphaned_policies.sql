-- Fix RLS Policy Issues - Phase 1: Clean Up Orphaned Policies
-- This migration removes all existing policies from tables where RLS is disabled
-- to resolve the "policy_exists_rls_disabled" errors from Supabase security advisor

-- ===================================================================
-- STEP 1: DROP ALL POLICIES FROM TABLES WHERE RLS IS DISABLED
-- ===================================================================

-- Drop all policies from profiles table
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for teachers to their students" ON public.profiles;
DROP POLICY IF EXISTS "Enable update access for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can access own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON public.profiles;
DROP POLICY IF EXISTS "Students can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow anonymous read for students" ON public.profiles;

-- Drop all policies from classes table
DROP POLICY IF EXISTS "Admin full access to classes" ON public.classes;
DROP POLICY IF EXISTS "Authenticated read classes" ON public.classes;
DROP POLICY IF EXISTS "Students can view class via session" ON public.classes;
DROP POLICY IF EXISTS "Teachers can manage their own classes" ON public.classes;
DROP POLICY IF EXISTS "Admins can manage all classes" ON public.classes;
DROP POLICY IF EXISTS "Admin access to classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view their classes" ON public.classes;
DROP POLICY IF EXISTS "Students can view their class" ON public.classes;
DROP POLICY IF EXISTS "Allow anonymous read for student access" ON public.classes;

-- Drop all policies from assignments table
DROP POLICY IF EXISTS "Students can view assignments via session" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can manage assignments for their classes" ON public.assignments;
DROP POLICY IF EXISTS "Admin access to assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can manage their assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teacher manage assignments" ON public.assignments;
DROP POLICY IF EXISTS "Students can view published assignments" ON public.assignments;
DROP POLICY IF EXISTS "Student view assignments" ON public.assignments;
DROP POLICY IF EXISTS "Allow anonymous read for assignments" ON public.assignments;

-- Drop all policies from recordings table
DROP POLICY IF EXISTS "Students can manage recordings via session" ON public.recordings;
DROP POLICY IF EXISTS "Teacher view recordings" ON public.recordings;
DROP POLICY IF EXISTS "Teachers can view recordings from their class assignments" ON public.recordings;
DROP POLICY IF EXISTS "Admin access to recordings" ON public.recordings;
DROP POLICY IF EXISTS "Students can manage their own recordings" ON public.recordings;
DROP POLICY IF EXISTS "Teachers can view recordings for their classes" ON public.recordings;

-- Drop all policies from recording_submissions table
DROP POLICY IF EXISTS "Admins have full access to recordings" ON public.recording_submissions;
DROP POLICY IF EXISTS "Students can insert their own recordings" ON public.recording_submissions;
DROP POLICY IF EXISTS "Students can view their own recordings" ON public.recording_submissions;
DROP POLICY IF EXISTS "Teachers can update class recordings" ON public.recording_submissions;
DROP POLICY IF EXISTS "Teachers can view class recordings" ON public.recording_submissions;

-- Drop all policies from class_sessions table (if any exist)
DROP POLICY IF EXISTS "Students can view class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Teachers can manage class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Admin access to class sessions" ON public.class_sessions;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check that no policies remain on these tables
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename IN ('profiles', 'classes', 'assignments', 'recordings', 'recording_submissions', 'class_sessions')
    AND schemaname = 'public';

-- This query should return no rows if all policies were successfully dropped

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
This migration completes Phase 1 of the RLS Policy Fix Plan:
- Removes all orphaned policies from tables where RLS is disabled
- Eliminates the "policy_exists_rls_disabled" errors
- Prepares tables for Phase 2: Re-enabling RLS with simple policies

Next steps:
1. Re-enable RLS on each table individually
2. Create simple, non-recursive policies
3. Test functionality after each table
*/