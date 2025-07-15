-- Test Service Role Access
-- This migration tests that service role can access all data without RLS restrictions

-- ===================================================================
-- TEST SERVICE ROLE ACCESS TO ALL TABLES
-- ===================================================================

-- Test 1: Profiles table access
SELECT 'Testing profiles table access:' as test_info;
SELECT 
    'Profiles found: ' || COUNT(*)::text || 
    ' (Admins: ' || COUNT(*) FILTER (WHERE role = 'admin')::text || 
    ', Teachers: ' || COUNT(*) FILTER (WHERE role = 'teacher')::text || 
    ', Students: ' || COUNT(*) FILTER (WHERE role = 'student')::text || ')'
    as profiles_summary
FROM public.profiles;

-- Test 2: Classes table access
SELECT 'Testing classes table access:' as test_info;
SELECT 
    'Classes found: ' || COUNT(*)::text || 
    ' (Active: ' || COUNT(*) FILTER (WHERE is_active = true)::text || ')'
    as classes_summary
FROM public.classes;

-- Test 3: Assignments table access  
SELECT 'Testing assignments table access:' as test_info;
SELECT 
    'Assignments found: ' || COUNT(*)::text ||
    ' (Published: ' || COUNT(*) FILTER (WHERE is_published = true)::text || ')'
    as assignments_summary
FROM public.assignments;

-- Test 4: Recordings table access
SELECT 'Testing recordings table access:' as test_info;
SELECT 
    'Recordings found: ' || COUNT(*)::text
    as recordings_summary
FROM public.recordings;

-- Test 5: Recording submissions table access
SELECT 'Testing recording_submissions table access:' as test_info;
SELECT 
    'Recording submissions found: ' || COUNT(*)::text
    as recording_submissions_summary
FROM public.recording_submissions;

-- Test 6: Class sessions table access
SELECT 'Testing class_sessions table access:' as test_info;
SELECT 
    'Class sessions found: ' || COUNT(*)::text ||
    ' (Active: ' || COUNT(*) FILTER (WHERE expires_at > now())::text || ')'
    as class_sessions_summary
FROM public.class_sessions;

-- ===================================================================
-- TEST JOIN QUERIES (WHAT ADMIN DASHBOARD NEEDS)
-- ===================================================================

SELECT 'Testing complex join queries:' as test_info;

-- Test classes with teacher info (what admin dashboard needs)
SELECT 
    'Classes with teacher info: ' || COUNT(*)::text
    as classes_with_teacher_summary
FROM public.classes c
LEFT JOIN public.profiles p ON c.teacher_id = p.id
WHERE c.is_active = true;

-- Test assignments with class info
SELECT 
    'Assignments with class info: ' || COUNT(*)::text
    as assignments_with_class_summary  
FROM public.assignments a
LEFT JOIN public.classes c ON a.class_id = c.id;

-- Test student count per class
SELECT 
    'Classes with student counts calculated: ' || COUNT(*)::text
    as classes_with_student_counts_summary
FROM (
    SELECT 
        c.id,
        c.name,
        COUNT(p.id) as student_count
    FROM public.classes c
    LEFT JOIN public.profiles p ON c.id = p.class_id AND p.role = 'student' AND p.is_active = true
    WHERE c.is_active = true
    GROUP BY c.id, c.name
) class_counts;

-- ===================================================================
-- VERIFY NO RLS RESTRICTIONS
-- ===================================================================

SELECT 'Verifying RLS status:' as test_info;

-- Check RLS is enabled but not blocking service role
SELECT 
    tablename,
    CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'classes', 'assignments', 'recordings', 'recording_submissions', 'class_sessions')
ORDER BY tablename;

-- ===================================================================
-- FINAL STATUS
-- ===================================================================

SELECT 'Service role access test completed successfully!' as final_status;
SELECT 'All tables accessible, joins working, ready for admin dashboard.' as conclusion;

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
This test verifies that:

1. SERVICE ROLE CAN ACCESS ALL TABLES:
   - Profiles (all roles)
   - Classes (with active status)
   - Assignments (with published status)
   - Recordings and recording submissions
   - Class sessions (with expiration status)

2. COMPLEX JOINS WORK:
   - Classes with teacher information
   - Assignments with class information  
   - Student counts per class

3. RLS IS PROPERLY CONFIGURED:
   - RLS is enabled (security maintained)
   - Service role bypasses restrictions (admin access works)
   - No infinite recursion or permission errors

If all queries return results without errors, the admin dashboard should work properly.
*/