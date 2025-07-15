-- Fix Admin Authentication Context Issues
-- This migration fixes the admin authentication context to work properly with RLS

-- ===================================================================
-- STEP 1: CREATE TEMPORARY BYPASS FOR ADMIN FUNCTIONS
-- ===================================================================

-- Create a function that bypasses RLS for admin operations
CREATE OR REPLACE FUNCTION public.admin_check_email_exists(check_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    email_exists BOOLEAN;
    current_user_id UUID;
    current_user_role TEXT;
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    -- Check if user is admin by querying directly (bypass RLS via SECURITY DEFINER)
    SELECT role INTO current_user_role 
    FROM public.profiles 
    WHERE id = current_user_id;
    
    -- Allow admin access or service role
    IF current_user_role = 'admin' OR current_user_id IS NULL THEN
        -- Check if email exists
        SELECT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE email = TRIM(check_email)
        ) INTO email_exists;
        
        RETURN email_exists;
    ELSE
        RAISE EXCEPTION 'Only admins can check email existence';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.admin_check_email_exists TO authenticated, service_role;

-- ===================================================================
-- STEP 2: UPDATE IS_ADMIN_SIMPLE TO BE MORE RELIABLE
-- ===================================================================

-- Recreate the admin check function with SECURITY DEFINER
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
    
    -- Query the profiles table directly (SECURITY DEFINER bypasses RLS)
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = current_user_id;
    
    -- Return true if user is admin
    RETURN (user_role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.is_admin_simple() TO authenticated, anon, service_role;

-- ===================================================================
-- STEP 3: UPDATE STUDENT CREATION FUNCTION
-- ===================================================================

-- Update student creation to not require admin check for email validation
CREATE OR REPLACE FUNCTION public.create_student_profile_simple(
    student_email TEXT,
    student_name TEXT,
    student_class_id UUID,
    visual_password_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_student_id UUID;
    current_user_id UUID;
    current_user_role TEXT;
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    -- Check if user is admin by querying directly (bypass RLS via SECURITY DEFINER)
    SELECT role INTO current_user_role 
    FROM public.profiles 
    WHERE id = current_user_id;
    
    -- Allow admin access or service role
    IF current_user_role != 'admin' AND current_user_id IS NOT NULL THEN
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
    
    -- Check for duplicate email (direct query with SECURITY DEFINER)
    IF EXISTS (SELECT 1 FROM public.profiles WHERE email = TRIM(student_email)) THEN
        RAISE EXCEPTION 'Email already exists';
    END IF;
    
    -- Verify class exists (direct query with SECURITY DEFINER)
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
    
    -- Insert student profile (direct insert with SECURITY DEFINER)
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
GRANT EXECUTE ON FUNCTION public.create_student_profile_simple TO authenticated, service_role;

-- ===================================================================
-- STEP 4: UPDATE TEACHER CREATION FUNCTION
-- ===================================================================

-- Update teacher creation function with proper admin check
CREATE OR REPLACE FUNCTION public.create_teacher_profile_simple(
    teacher_id UUID,
    teacher_email TEXT,
    teacher_name TEXT
)
RETURNS UUID AS $$
DECLARE
    current_user_id UUID;
    current_user_role TEXT;
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    -- Check if user is admin by querying directly (bypass RLS via SECURITY DEFINER)
    SELECT role INTO current_user_role 
    FROM public.profiles 
    WHERE id = current_user_id;
    
    -- Allow admin access or service role
    IF current_user_role != 'admin' AND current_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'Only admins can create teachers';
    END IF;
    
    -- Validate inputs
    IF teacher_email IS NULL OR TRIM(teacher_email) = '' THEN
        RAISE EXCEPTION 'Teacher email is required';
    END IF;
    
    IF teacher_name IS NULL OR TRIM(teacher_name) = '' THEN
        RAISE EXCEPTION 'Teacher name is required';
    END IF;
    
    -- Insert or update teacher profile (direct insert with SECURITY DEFINER)
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
GRANT EXECUTE ON FUNCTION public.create_teacher_profile_simple TO authenticated, service_role;

-- ===================================================================
-- STEP 5: UPDATE ADMIN DASHBOARD FUNCTIONS
-- ===================================================================

-- Update admin_get_all_profiles with proper admin check
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
DECLARE
    current_user_id UUID;
    current_user_role TEXT;
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    -- Check if user is admin by querying directly (bypass RLS via SECURITY DEFINER)
    SELECT role INTO current_user_role 
    FROM public.profiles 
    WHERE id = current_user_id;
    
    -- Allow admin access or service role
    IF current_user_role != 'admin' AND current_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'Only admins can access all profiles';
    END IF;

    -- Return all profiles with class info (direct query with SECURITY DEFINER)
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
GRANT EXECUTE ON FUNCTION public.admin_get_all_profiles TO authenticated, service_role;

-- ===================================================================
-- STEP 6: UPDATE ADMIN CLASSES FUNCTION
-- ===================================================================

-- Update admin_get_classes_with_counts with proper admin check
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
DECLARE
    current_user_id UUID;
    current_user_role TEXT;
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    -- Check if user is admin by querying directly (bypass RLS via SECURITY DEFINER)
    SELECT role INTO current_user_role 
    FROM public.profiles 
    WHERE id = current_user_id;
    
    -- Allow admin access or service role
    IF current_user_role != 'admin' AND current_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'Only admins can access all classes';
    END IF;

    -- Return classes with teacher info and student counts (direct query with SECURITY DEFINER)
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
GRANT EXECUTE ON FUNCTION public.admin_get_classes_with_counts TO authenticated, service_role;

-- ===================================================================
-- STEP 7: VERIFICATION
-- ===================================================================

-- Test the updated functions
SELECT 'Testing updated admin functions:' as test_info;

-- Test is_admin_simple
SELECT 'is_admin_simple result: ' || public.is_admin_simple()::text as admin_check;

-- Test if current user has admin role
SELECT 'Current user role: ' || COALESCE(role, 'UNKNOWN') as user_role
FROM public.profiles WHERE id = auth.uid();

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
This migration fixes the admin authentication context issues:

KEY CHANGES:
1. All admin functions now use SECURITY DEFINER to bypass RLS
2. Admin checking is done by directly querying profiles table
3. Functions handle both authenticated users and service role properly
4. Better error handling and permission checks

SECURITY MODEL:
- Functions use SECURITY DEFINER to bypass RLS when needed
- Admin role is checked by directly querying profiles table
- Service role (current_user_id IS NULL) is allowed for system operations
- Regular users are properly blocked from admin operations

This should fix:
- "Only admins can check email existence" error
- Student creation 409 conflicts
- Teacher creation 406 errors
- Admin dashboard empty results
*/