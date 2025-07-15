-- Fix Admin Functions for New RLS Policies
-- This migration ensures all admin functions work properly with the updated RLS policies

-- ===================================================================
-- STEP 1: UPDATE ADMIN FUNCTION TO WORK WITH RLS
-- ===================================================================

-- Drop and recreate the admin function with proper RLS handling
DROP FUNCTION IF EXISTS public.admin_get_classes_with_counts();

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
    -- Check admin access
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can access all classes';
    END IF;

    -- Return classes with teacher info and student counts
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.grade_level,
        c.teacher_id,
        COALESCE(c.school_year, '')::TEXT as school_year,
        COALESCE(c.description, '')::TEXT as description,
        COALESCE(c.max_students, 30)::INTEGER as max_students,
        COALESCE(c.access_token, '')::TEXT as access_token,
        c.is_active,
        c.created_at,
        c.updated_at,
        COALESCE(student_counts.student_count, 0)::BIGINT as student_count,
        COALESCE(teacher_profiles.full_name, 'Unknown')::TEXT as teacher_name,
        COALESCE(teacher_profiles.email, '')::TEXT as teacher_email
    FROM public.classes c
    LEFT JOIN public.profiles teacher_profiles ON c.teacher_id = teacher_profiles.id
    LEFT JOIN (
        SELECT 
            class_id,
            COUNT(*) as student_count
        FROM public.profiles 
        WHERE role = 'student' AND is_active = true
        GROUP BY class_id
    ) student_counts ON c.id = student_counts.class_id
    WHERE c.is_active = true
    ORDER BY c.grade_level, c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.admin_get_classes_with_counts() TO authenticated;

-- ===================================================================
-- STEP 2: UPDATE STUDENT CREATION FUNCTION
-- ===================================================================

-- Ensure the student creation function works with new RLS policies
CREATE OR REPLACE FUNCTION public.create_student_profile_simple(
    student_email TEXT,
    student_name TEXT,
    student_class_id UUID,
    visual_password_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_student_id UUID;
BEGIN
    -- Check admin access
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can create students';
    END IF;
    
    -- Validate inputs
    IF student_email IS NULL OR TRIM(student_email) = '' THEN
        RAISE EXCEPTION 'Student email is required';
    END IF;
    
    IF student_name IS NULL OR TRIM(student_name) = '' THEN
        RAISE EXCEPTION 'Student name is required';
    END IF;
    
    IF student_class_id IS NULL THEN
        RAISE EXCEPTION 'Class ID is required';
    END IF;
    
    -- Check for duplicate email
    IF EXISTS (SELECT 1 FROM public.profiles WHERE email = TRIM(student_email)) THEN
        RAISE EXCEPTION 'Email already exists';
    END IF;
    
    -- Verify class exists
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = student_class_id AND is_active = true) THEN
        RAISE EXCEPTION 'Invalid or inactive class ID';
    END IF;
    
    -- Check if visual password exists (if provided)
    IF visual_password_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.visual_passwords WHERE id = visual_password_id) THEN
            RAISE EXCEPTION 'Invalid visual password ID';
        END IF;
    END IF;
    
    -- Generate new UUID
    new_student_id := gen_random_uuid();
    
    -- Insert student profile
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        class_id,
        visual_password_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        new_student_id,
        TRIM(student_email),
        TRIM(student_name),
        'student',
        student_class_id,
        visual_password_id,
        true,
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created student profile for % with ID %', student_name, new_student_id;
    RETURN new_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_student_profile_simple TO authenticated;

-- ===================================================================
-- STEP 3: UPDATE TEACHER CREATION FUNCTION
-- ===================================================================

-- Ensure the teacher creation function works with new RLS policies
CREATE OR REPLACE FUNCTION public.create_teacher_profile_simple(
    teacher_id UUID,
    teacher_email TEXT,
    teacher_name TEXT
)
RETURNS UUID AS $$
BEGIN
    -- Check admin access
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can create teachers';
    END IF;
    
    -- Validate inputs
    IF teacher_email IS NULL OR TRIM(teacher_email) = '' THEN
        RAISE EXCEPTION 'Teacher email is required';
    END IF;
    
    IF teacher_name IS NULL OR TRIM(teacher_name) = '' THEN
        RAISE EXCEPTION 'Teacher name is required';
    END IF;
    
    -- Insert or update teacher profile
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        teacher_id,
        TRIM(teacher_email),
        TRIM(teacher_name),
        'teacher',
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();
    
    RAISE NOTICE 'Created/updated teacher profile for % with ID %', teacher_name, teacher_id;
    RETURN teacher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_teacher_profile_simple TO authenticated;

-- ===================================================================
-- STEP 4: CREATE ADMIN PROFILE FETCHING FUNCTION
-- ===================================================================

-- Create a function to get all profiles for admin dashboard
CREATE OR REPLACE FUNCTION public.admin_get_all_profiles()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    role TEXT,
    class_id UUID,
    visual_password_id TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    class_name TEXT
) AS $$
BEGIN
    -- Check admin access
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can access all profiles';
    END IF;

    -- Return all profiles with class info
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name,
        p.role,
        p.class_id,
        p.visual_password_id,
        p.is_active,
        p.created_at,
        p.updated_at,
        COALESCE(c.name, 'No Class')::TEXT as class_name
    FROM public.profiles p
    LEFT JOIN public.classes c ON p.class_id = c.id
    ORDER BY p.role, p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.admin_get_all_profiles TO authenticated;

-- ===================================================================
-- STEP 5: CREATE FUNCTION TO CHECK EMAIL UNIQUENESS
-- ===================================================================

-- Create a function to check if email exists (for admin use)
CREATE OR REPLACE FUNCTION public.admin_check_email_exists(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check admin access
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can check email existence';
    END IF;
    
    -- Check if email exists
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE email = TRIM(check_email)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.admin_check_email_exists TO authenticated;

-- ===================================================================
-- STEP 6: VERIFICATION QUERIES
-- ===================================================================

-- Test admin function
SELECT 'Testing is_admin_simple function:' as info;
SELECT public.is_admin_simple() as is_admin_result;

-- Test email check function
SELECT 'Testing admin_check_email_exists function:' as info;
SELECT public.admin_check_email_exists('test@example.com') as email_exists_result;

-- List all admin functions
SELECT 'Available admin functions:' as info;
SELECT proname as function_name, prosecdef as is_security_definer
FROM pg_proc 
WHERE proname LIKE 'admin_%' OR proname LIKE '%_admin%' OR proname LIKE 'create_%'
ORDER BY proname;

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
This migration fixes all admin functions to work with the new RLS policies:

FUNCTIONS UPDATED:
1. admin_get_classes_with_counts() - Now properly handles RLS and returns teacher info
2. create_student_profile_simple() - Added email uniqueness check, better error handling
3. create_teacher_profile_simple() - Improved validation and error handling
4. admin_get_all_profiles() - New function for admin dashboard to get all users
5. admin_check_email_exists() - New function for checking email uniqueness

KEY IMPROVEMENTS:
- All functions use SECURITY DEFINER to bypass RLS when needed
- Proper admin access checks using is_admin_simple()
- Better error handling and validation
- Email uniqueness checking for student creation
- Admin dashboard functions to get all data

SECURITY FEATURES:
- Admin role verification on all functions
- Input validation and sanitization
- Proper error messages without exposing internal details
- Functions only accessible to authenticated users

This should fix:
- 409 Conflict error when creating students
- 406 Not Acceptable error when creating teachers
- Empty admin dashboard
- All admin functionality requiring cross-user access
*/