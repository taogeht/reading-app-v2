-- Emergency Fix for Infinite Recursion in RLS Policies
-- This migration removes the problematic admin policies that cause infinite recursion

-- ===================================================================
-- STEP 1: REMOVE PROBLEMATIC ADMIN POLICIES
-- ===================================================================

-- Remove the admin policies that cause infinite recursion
-- These policies try to check admin status by querying the profiles table from within profiles policies

-- Remove from profiles table
DROP POLICY IF EXISTS "Admin users can access all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read basic profile data" ON public.profiles;

-- Remove from classes table
DROP POLICY IF EXISTS "Admin users can access all classes" ON public.classes;

-- Remove from assignments table
DROP POLICY IF EXISTS "Admin users can access all assignments" ON public.assignments;

-- Remove from recording_submissions table
DROP POLICY IF EXISTS "Admin users can access all recording submissions" ON public.recording_submissions;

-- Remove from recordings table (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'recordings' AND schemaname = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admin users can access all recordings" ON public.recordings';
    END IF;
END $$;

-- Remove from class_sessions table
DROP POLICY IF EXISTS "Admin users can access all class sessions" ON public.class_sessions;

-- ===================================================================
-- STEP 2: VERIFY ALL PROBLEMATIC POLICIES ARE REMOVED
-- ===================================================================

-- Check for any remaining policies that might cause recursion
SELECT 
    schemaname,
    tablename,
    policyname,
    roles
FROM pg_policies 
WHERE schemaname = 'public'
    AND (
        policyname LIKE '%admin%' 
        OR policyname LIKE '%Admin%'
        OR policyname LIKE '%authenticated%'
    )
ORDER BY tablename, policyname;

-- ===================================================================
-- STEP 3: KEEP ONLY SIMPLE, NON-RECURSIVE POLICIES
-- ===================================================================

-- List the policies that remain (should be simple, non-recursive ones)
SELECT 
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'classes', 'assignments', 'recordings', 'recording_submissions', 'class_sessions')
ORDER BY tablename, policyname;

-- ===================================================================
-- STEP 4: TEST THAT RECURSION IS FIXED
-- ===================================================================

-- Test basic profile access
SELECT 'Testing basic profile access:' as test_info;

-- This should work without recursion
DO $$
DECLARE
    profile_count INTEGER;
BEGIN
    BEGIN
        SELECT COUNT(*) INTO profile_count FROM public.profiles WHERE role = 'admin';
        RAISE NOTICE 'Admin profiles found: %', profile_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Profile query failed: %', SQLERRM;
    END;
END $$;

-- ===================================================================
-- STEP 5: UPDATE ADMIN FUNCTIONS TO WORK WITHOUT RECURSIVE POLICIES
-- ===================================================================

-- Since we can't use recursive policies, admin functions must use service role
-- Update the admin functions to work with the current user authentication

-- Update is_admin_simple to work without recursive policies
CREATE OR REPLACE FUNCTION public.is_admin_simple()
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    user_role TEXT;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- If no user ID, return false
    IF current_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- This function has SECURITY DEFINER, so it can bypass RLS
    -- Query the profiles table directly 
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = current_user_id;
    
    -- Return true if user is admin
    RETURN (user_role = 'admin');
    
EXCEPTION
    WHEN OTHERS THEN
        -- If there's any error, return false
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.is_admin_simple() TO authenticated, anon, service_role;

-- ===================================================================
-- STEP 6: FINAL VERIFICATION
-- ===================================================================

-- Final test to ensure no more infinite recursion
SELECT 'Final recursion test:' as test_info;

-- Test that we can query profiles without infinite recursion
SELECT 
    'Total profiles: ' || COUNT(*)::text as profile_summary
FROM public.profiles;

-- Test that we can query classes without infinite recursion
SELECT 
    'Total classes: ' || COUNT(*)::text as class_summary
FROM public.classes;

-- Test admin function
SELECT 
    'Admin function result: ' || public.is_admin_simple()::text as admin_test;

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
EMERGENCY FIX FOR INFINITE RECURSION:

PROBLEM:
- Admin policies like "Admin users can access all profiles" caused infinite recursion
- These policies checked admin status by querying the profiles table from within profiles policies
- This created a circular dependency: profiles policy → admin check → profiles query → profiles policy

SOLUTION:
- Removed all problematic admin policies that caused recursion
- Kept only simple, non-recursive policies
- Admin functions now rely on SECURITY DEFINER to bypass RLS
- Service role should be used for admin operations in the application

REMAINING SECURITY MODEL:
- Regular users: Can only access their own data via simple policies
- Teachers: Can access their class data via simple policies  
- Students: Can access via anonymous policies
- Admins: Must use admin functions with SECURITY DEFINER or service role
- Service role: Full access via service role bypass

NEXT STEPS:
1. Use service role for admin operations in the application
2. Admin functions work via SECURITY DEFINER
3. Test that all functionality works without infinite recursion
*/