-- ENABLE STUDENT CLASS ACCESS: Complete fix for visual password flow
-- This script creates the missing functions and enables the admin dashboard

-- =============================================================================
-- STEP 1: ENSURE ALL REQUIRED FUNCTIONS EXIST
-- =============================================================================

-- Ensure is_admin_simple function exists
CREATE OR REPLACE FUNCTION public.is_admin_simple()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin',
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_admin_simple TO authenticated;

-- =============================================================================
-- STEP 2: ENABLE CLASS CREATION (from previous fixes)
-- =============================================================================

-- Create class creation function
CREATE OR REPLACE FUNCTION public.admin_create_class(
    class_name TEXT,
    class_grade_level INTEGER,
    class_teacher_id UUID,
    class_school_year TEXT DEFAULT '2024-2025',
    class_description TEXT DEFAULT '',
    class_max_students INTEGER DEFAULT 25
)
RETURNS UUID AS $$
DECLARE
    new_class_id UUID;
    generated_token TEXT;
BEGIN
    -- Check admin access
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can create classes';
    END IF;
    
    -- Validate inputs
    IF class_name IS NULL OR TRIM(class_name) = '' THEN
        RAISE EXCEPTION 'Class name is required';
    END IF;
    
    IF class_grade_level IS NULL OR class_grade_level < 1 OR class_grade_level > 12 THEN
        RAISE EXCEPTION 'Grade level must be between 1 and 12';
    END IF;
    
    IF class_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Teacher ID is required';
    END IF;
    
    -- Verify teacher exists
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = class_teacher_id 
        AND role = 'teacher' 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Invalid or inactive teacher ID';
    END IF;
    
    -- Generate access token
    generated_token := UPPER(LEFT(MD5(RANDOM()::TEXT), 8));
    
    -- Insert class
    INSERT INTO public.classes (
        name,
        grade_level,
        teacher_id,
        school_year,
        description,
        max_students,
        access_token,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        TRIM(class_name),
        class_grade_level,
        class_teacher_id,
        COALESCE(NULLIF(TRIM(class_school_year), ''), '2024-2025'),
        COALESCE(TRIM(class_description), ''),
        COALESCE(class_max_students, 25),
        generated_token,
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO new_class_id;
    
    RETURN new_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_create_class TO authenticated;

-- =============================================================================
-- STEP 3: ENABLE STUDENT CREATION (from previous fixes)
-- =============================================================================

-- Create student creation function (without foreign key constraints)
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
    
    -- Verify class exists
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = student_class_id AND is_active = true) THEN
        RAISE EXCEPTION 'Invalid or inactive class ID';
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
    
    RETURN new_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_student_profile_simple TO authenticated;

-- =============================================================================
-- STEP 4: ENABLE TEACHER CREATION
-- =============================================================================

-- Create teacher profile function
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
    
    -- Insert teacher profile
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
    
    RETURN teacher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_teacher_profile_simple TO authenticated;

-- =============================================================================
-- STEP 5: CREATE ADMIN CLASSES QUERY FUNCTION
-- =============================================================================

-- Create function to get classes for admin dashboard
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
    
    -- Return classes with student counts
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.grade_level,
        c.teacher_id,
        COALESCE(c.school_year, '2024-2025') as school_year,
        COALESCE(c.description, '') as description,
        COALESCE(c.max_students, 25) as max_students,
        COALESCE(c.access_token, '') as access_token,
        c.is_active,
        c.created_at,
        c.updated_at,
        (
            SELECT COUNT(*)::BIGINT 
            FROM public.profiles p 
            WHERE p.class_id = c.id 
            AND p.role = 'student' 
            AND p.is_active = true
        ) as student_count,
        COALESCE(t.full_name, 'Unknown Teacher') as teacher_name,
        COALESCE(t.email, '') as teacher_email
    FROM public.classes c
    LEFT JOIN public.profiles t ON t.id = c.teacher_id
    WHERE c.is_active = true
    ORDER BY c.grade_level, c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_get_classes_with_counts TO authenticated;

-- =============================================================================
-- STEP 6: ENSURE VISUAL PASSWORDS EXIST
-- =============================================================================

-- Create visual passwords if they don't exist
INSERT INTO public.visual_passwords (id, name, category, display_emoji, created_at) VALUES
('cat', 'Cat', 'animals', '🐱', NOW()),
('dog', 'Dog', 'animals', '🐶', NOW()),
('rabbit', 'Rabbit', 'animals', '🐰', NOW()),
('fish', 'Fish', 'animals', '🐟', NOW()),
('red', 'Red', 'colors', '🔴', NOW()),
('blue', 'Blue', 'colors', '🔵', NOW()),
('green', 'Green', 'colors', '🟢', NOW()),
('yellow', 'Yellow', 'colors', '🟡', NOW()),
('star', 'Star', 'shapes', '⭐', NOW()),
('heart', 'Heart', 'shapes', '❤️', NOW()),
('circle', 'Circle', 'shapes', '⭕', NOW()),
('square', 'Square', 'shapes', '⬜', NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STEP 7: ENSURE PROPER RLS POLICIES
-- =============================================================================

-- Ensure classes table allows student access (no auth required for reading)
DROP POLICY IF EXISTS "Allow anonymous read for student access" ON public.classes;
CREATE POLICY "Allow anonymous read for student access" ON public.classes
    FOR SELECT USING (true);

-- Ensure profiles table allows student access
DROP POLICY IF EXISTS "Allow anonymous read for students" ON public.profiles;
CREATE POLICY "Allow anonymous read for students" ON public.profiles
    FOR SELECT USING (role = 'student');

-- Ensure visual passwords are readable by all
DROP POLICY IF EXISTS "Allow anonymous read for visual passwords" ON public.visual_passwords;
CREATE POLICY "Allow anonymous read for visual passwords" ON public.visual_passwords
    FOR SELECT USING (true);

-- =============================================================================
-- STEP 8: VERIFICATION
-- =============================================================================

-- Test that functions exist
SELECT 'Functions created successfully:' as info;
SELECT proname as function_name
FROM pg_proc 
WHERE proname IN ('admin_create_class', 'create_student_profile_simple', 'admin_get_classes_with_counts', 'is_admin_simple')
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Test visual passwords
SELECT 'Visual passwords available:' as info;
SELECT COUNT(*) as password_count FROM public.visual_passwords;

SELECT 'Setup complete! Admin dashboard should now work.' as final_status;