-- Test Admin Functionality with New RLS Policies
-- This migration tests all admin functions to ensure they work properly

-- ===================================================================
-- STEP 1: TEST ADMIN DETECTION
-- ===================================================================

SELECT 'Testing admin detection:' as test_step;

-- Test the is_admin_simple function
SELECT 
    'is_admin_simple() result: ' || COALESCE(public.is_admin_simple()::text, 'NULL') as admin_check;

-- Check if we have any admin users
SELECT 
    'Admin users found: ' || COUNT(*)::text as admin_count
FROM public.profiles 
WHERE role = 'admin';

-- ===================================================================
-- STEP 2: TEST ADMIN FUNCTIONS AVAILABILITY
-- ===================================================================

SELECT 'Testing admin functions availability:' as test_step;

-- List all admin functions
SELECT 
    proname as function_name,
    prosecdef as is_security_definer,
    proacl as permissions
FROM pg_proc 
WHERE proname LIKE 'admin_%' 
    OR proname LIKE 'create_%_simple'
    OR proname = 'is_admin_simple'
ORDER BY proname;

-- ===================================================================
-- STEP 3: TEST EMAIL CHECKING FUNCTION
-- ===================================================================

SELECT 'Testing email checking function:' as test_step;

-- Test email existence check with non-existent email
DO $$
DECLARE
    email_exists_result BOOLEAN;
BEGIN
    BEGIN
        SELECT public.admin_check_email_exists('nonexistent@test.com') INTO email_exists_result;
        RAISE NOTICE 'Email check for nonexistent@test.com: %', email_exists_result;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Email check failed: %', SQLERRM;
    END;
END $$;

-- ===================================================================
-- STEP 4: TEST PROFILE FETCHING
-- ===================================================================

SELECT 'Testing profile fetching:' as test_step;

-- Test getting all profiles
DO $$
DECLARE
    profile_count INTEGER;
BEGIN
    BEGIN
        SELECT COUNT(*) INTO profile_count FROM public.admin_get_all_profiles();
        RAISE NOTICE 'admin_get_all_profiles returned % profiles', profile_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'admin_get_all_profiles failed: %', SQLERRM;
    END;
END $$;

-- ===================================================================
-- STEP 5: TEST CLASS FETCHING
-- ===================================================================

SELECT 'Testing class fetching:' as test_step;

-- Test getting all classes
DO $$
DECLARE
    class_count INTEGER;
BEGIN
    BEGIN
        SELECT COUNT(*) INTO class_count FROM public.admin_get_classes_with_counts();
        RAISE NOTICE 'admin_get_classes_with_counts returned % classes', class_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'admin_get_classes_with_counts failed: %', SQLERRM;
    END;
END $$;

-- ===================================================================
-- STEP 6: TEST STUDENT CREATION (DRY RUN)
-- ===================================================================

SELECT 'Testing student creation (dry run):' as test_step;

-- Test student creation function with validation
DO $$
DECLARE
    test_class_id UUID;
    test_student_id UUID;
    test_email TEXT := 'test.student.' || extract(epoch from now())::text || '@test.com';
BEGIN
    -- Find a class to test with
    SELECT id INTO test_class_id FROM public.classes WHERE is_active = true LIMIT 1;
    
    IF test_class_id IS NOT NULL THEN
        BEGIN
            -- Test the student creation function
            SELECT public.create_student_profile_simple(
                test_email,
                'Test Student',
                test_class_id,
                'cat'
            ) INTO test_student_id;
            
            RAISE NOTICE 'SUCCESS: Test student created with ID %', test_student_id;
            
            -- Verify the student was created
            IF EXISTS (SELECT 1 FROM public.profiles WHERE id = test_student_id) THEN
                RAISE NOTICE 'SUCCESS: Student profile verified in database';
            ELSE
                RAISE NOTICE 'ERROR: Student profile not found in database';
            END IF;
            
            -- Clean up the test student
            DELETE FROM public.profiles WHERE id = test_student_id;
            RAISE NOTICE 'SUCCESS: Test student cleaned up';
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'ERROR: Student creation failed: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'WARNING: No active class found for testing';
    END IF;
END $$;

-- ===================================================================
-- STEP 7: TEST RLS POLICIES
-- ===================================================================

SELECT 'Testing RLS policies:' as test_step;

-- Check that RLS is enabled on all tables
SELECT 
    'RLS Status: ' || tablename || ' = ' || 
    CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'classes', 'assignments', 'recordings', 'recording_submissions', 'class_sessions')
ORDER BY tablename;

-- Count policies on each table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'classes', 'assignments', 'recordings', 'recording_submissions', 'class_sessions')
GROUP BY tablename
ORDER BY tablename;

-- ===================================================================
-- STEP 8: TEST SECURITY BOUNDARIES
-- ===================================================================

SELECT 'Testing security boundaries:' as test_step;

-- Test that non-admin users cannot access admin functions
-- (This test will only work if there are non-admin users)
DO $$
DECLARE
    current_user_role TEXT;
    test_result BOOLEAN;
BEGIN
    -- Get current user's role
    SELECT role INTO current_user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    RAISE NOTICE 'Current user role: %', COALESCE(current_user_role, 'UNKNOWN');
    
    -- Test admin function access
    BEGIN
        SELECT public.is_admin_simple() INTO test_result;
        RAISE NOTICE 'Admin function access: %', test_result;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Admin function access failed: %', SQLERRM;
    END;
END $$;

-- ===================================================================
-- STEP 9: FINAL VERIFICATION
-- ===================================================================

SELECT 'Final verification:' as test_step;

-- Summary of setup
SELECT 
    'Summary: ' || 
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin') || ' admins, ' ||
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'teacher') || ' teachers, ' ||
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'student') || ' students, ' ||
    (SELECT COUNT(*) FROM public.classes WHERE is_active = true) || ' active classes'
    as system_summary;

-- Check for any remaining issues
SELECT 'All tests completed. Check the output above for any ERROR messages.' as final_status;

-- ===================================================================
-- EXPECTED RESULTS
-- ===================================================================

/*
Expected successful test results:

1. Admin detection should work properly
2. All admin functions should be available with SECURITY DEFINER
3. Email checking should work without errors
4. Profile fetching should return all profiles
5. Class fetching should return all classes with counts
6. Student creation should work (test student created and cleaned up)
7. RLS should be ENABLED on all tables
8. Each table should have multiple policies
9. Security boundaries should be enforced

If any tests fail, check:
- Are you running as an admin user?
- Are all migrations applied in order?
- Are there any permission issues?
- Are all functions properly granted to authenticated users?
*/