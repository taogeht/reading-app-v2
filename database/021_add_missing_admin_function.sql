-- ADD MISSING ADMIN FUNCTION: Fix 404 error for admin_get_classes_with_counts
-- This adds the missing function that the dashboard is trying to call

-- =============================================================================
-- CREATE THE MISSING ADMIN FUNCTION
-- =============================================================================

-- Create admin helper function for classes with counts (CRITICAL - dashboard calls this)
CREATE OR REPLACE FUNCTION public.admin_get_classes_with_counts()
RETURNS TABLE (
    id UUID,
    name TEXT,
    grade_level INTEGER,
    teacher_id UUID,
    school_year TEXT,
    description TEXT,
    max_students INTEGER,
    access_token TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    student_count BIGINT,
    teacher_name TEXT,
    teacher_email TEXT
) AS $$
BEGIN
    -- Check if user is admin using the safe admin function
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can access all classes';
    END IF;

    -- Return class data with student counts and teacher info
    RETURN QUERY
    SELECT c.id, c.name, c.grade_level, c.teacher_id, c.school_year, c.description,
           c.max_students, c.access_token, c.is_active, c.created_at, c.updated_at,
           COUNT(p.id) as student_count,
           t.full_name as teacher_name,
           t.email as teacher_email
    FROM public.classes c
    LEFT JOIN public.profiles p ON p.class_id = c.id AND p.role = 'student' AND p.is_active = true
    LEFT JOIN public.profiles t ON t.id = c.teacher_id
    WHERE c.is_active = true
    GROUP BY c.id, c.name, c.grade_level, c.teacher_id, c.school_year, c.description,
             c.max_students, c.access_token, c.is_active, c.created_at, c.updated_at,
             t.full_name, t.email
    ORDER BY c.grade_level, c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- GRANT EXECUTE PERMISSION
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.admin_get_classes_with_counts TO authenticated;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Test that the function exists
SELECT 'Function check:' as info;
SELECT 
    proname as function_name,
    'EXISTS' as status
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND proname = 'admin_get_classes_with_counts';

-- Test that it has proper permissions
SELECT 'Permission check:' as info;
SELECT 
    grantee,
    privilege_type
FROM information_schema.routine_privileges 
WHERE routine_name = 'admin_get_classes_with_counts'
    AND routine_schema = 'public';

SELECT 'admin_get_classes_with_counts function is now available!' as final_status;