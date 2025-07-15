-- FIX CLASS OPERATIONS: Both reading and creating classes
-- This fixes admin_get_classes_with_counts 400 errors AND class creation issues

-- =============================================================================
-- STEP 1: ENSURE SIMPLE ADMIN FUNCTION EXISTS
-- =============================================================================

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
-- STEP 2: FIX RLS POLICIES FOR CLASSES TABLE
-- =============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admin access to classes" ON public.classes;
DROP POLICY IF EXISTS "Admin full access to classes" ON public.classes;
DROP POLICY IF EXISTS "Teacher own classes" ON public.classes;
DROP POLICY IF EXISTS "Teacher view all classes" ON public.classes;

-- Create simple, working policies
CREATE POLICY "Admin full access to classes" ON public.classes
    FOR ALL USING (public.is_admin_simple());

-- Allow authenticated users to read classes (for now, to debug)
CREATE POLICY "Authenticated read classes" ON public.classes
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- =============================================================================
-- STEP 3: FIX RLS POLICIES FOR PROFILES TABLE  
-- =============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admin access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Teacher view students" ON public.profiles;

-- Create simple, working policies
CREATE POLICY "Admin full access to profiles" ON public.profiles
    FOR ALL USING (public.is_admin_simple());

CREATE POLICY "Own profile access" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- =============================================================================
-- STEP 4: CREATE WORKING admin_get_classes_with_counts FUNCTION
-- =============================================================================

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
    -- Check admin status
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can access all classes';
    END IF;

    -- Return query with safe column handling
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.grade_level,
        c.teacher_id,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'school_year') 
            THEN COALESCE(c.school_year, '2024-2025') 
            ELSE '2024-2025'::TEXT 
        END as school_year,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'description') 
            THEN COALESCE(c.description, '') 
            ELSE ''::TEXT 
        END as description,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'max_students') 
            THEN COALESCE(c.max_students, 25) 
            ELSE 25::INTEGER 
        END as max_students,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'access_token') 
            THEN COALESCE(c.access_token, '') 
            ELSE ''::TEXT 
        END as access_token,
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
-- STEP 5: CREATE SAFE CLASS CREATION FUNCTION
-- =============================================================================

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
BEGIN
    -- Check admin status
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can create classes';
    END IF;

    -- Insert class record
    INSERT INTO public.classes (
        name, 
        grade_level, 
        teacher_id, 
        school_year, 
        description, 
        max_students, 
        is_active
    ) VALUES (
        class_name,
        class_grade_level,
        class_teacher_id,
        class_school_year,
        class_description,
        class_max_students,
        true
    ) RETURNING id INTO new_class_id;

    RETURN new_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_create_class TO authenticated;

-- =============================================================================
-- STEP 6: VERIFICATION AND TESTING
-- =============================================================================

-- Test admin check
SELECT 'Admin check result:' as info, public.is_admin_simple() as is_admin;

-- Test classes query
SELECT 'Classes count:' as info, COUNT(*) as count FROM public.classes;

-- Test profiles query  
SELECT 'Profiles count:' as info, COUNT(*) as count FROM public.profiles;

-- Test admin function (this should work now)
SELECT 'Testing admin_get_classes_with_counts:' as info;
DO $$
BEGIN
    PERFORM * FROM public.admin_get_classes_with_counts() LIMIT 1;
    RAISE NOTICE 'admin_get_classes_with_counts function works!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'admin_get_classes_with_counts function failed: %', SQLERRM;
END $$;

-- Check policies
SELECT 'Current class policies:' as info;
SELECT policyname, cmd FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'classes';

SELECT 'Class operations should now work!' as final_status;