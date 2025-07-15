-- CORRECTED Emergency Fix: Disable problematic RLS policies causing infinite recursion
-- Run this FIRST to stop the 500 errors and allow the admin dashboard to load

-- =============================================================================
-- DISABLE PROBLEMATIC POLICIES TEMPORARILY
-- =============================================================================

-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Enable read access for admins" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert access for admins" ON public.profiles;
DROP POLICY IF EXISTS "Enable update access for admins" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Drop class policies
DROP POLICY IF EXISTS "Admins can manage all classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view their classes" ON public.classes;

-- Drop assignment policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assignments') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all assignments" ON public.assignments';
        EXECUTE 'DROP POLICY IF EXISTS "Teachers can manage their assignments" ON public.assignments';
    END IF;
END $$;

-- Drop recording policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recordings') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can view all recordings" ON public.recordings';
        EXECUTE 'DROP POLICY IF EXISTS "Students can view their recordings" ON public.recordings';
    END IF;
END $$;

-- =============================================================================
-- CREATE SIMPLE, NON-RECURSIVE POLICIES FOR ADMIN ACCESS
-- =============================================================================

-- Simple admin access policy for profiles (no recursion)
CREATE POLICY "Admin full access to profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Allow users to view/update their own profile
CREATE POLICY "Users own profile access" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- Simple admin access for classes
CREATE POLICY "Admin full access to classes" ON public.classes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Simple admin access for assignments (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assignments') THEN
        EXECUTE 'CREATE POLICY "Admin full access to assignments" ON public.assignments
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM auth.users 
                    WHERE auth.users.id = auth.uid() 
                    AND auth.users.raw_user_meta_data->>''role'' = ''admin''
                )
            )';
    END IF;
END $$;

-- Simple admin access for recordings (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recordings') THEN
        EXECUTE 'CREATE POLICY "Admin full access to recordings" ON public.recordings
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM auth.users 
                    WHERE auth.users.id = auth.uid() 
                    AND auth.users.raw_user_meta_data->>''role'' = ''admin''
                )
            )';
    END IF;
END $$;

-- =============================================================================
-- CREATE SAFE ADMIN FUNCTIONS
-- =============================================================================

-- Create a safe function to check if user is admin (no RLS conflicts)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = user_id 
        AND raw_user_meta_data->>'role' = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create safe teacher creation function
CREATE OR REPLACE FUNCTION public.create_teacher_profile(
    teacher_id UUID,
    teacher_email TEXT,
    teacher_name TEXT
)
RETURNS void AS $$
BEGIN
    -- Only allow if current user is admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can create teacher profiles';
    END IF;

    -- Insert/update the profile record (bypassing RLS due to SECURITY DEFINER)
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (teacher_id, teacher_email, teacher_name, 'teacher', true)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = 'teacher',
        is_active = true;
        
    -- Update the auth.users metadata
    UPDATE auth.users 
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "teacher"}'::jsonb
    WHERE id = teacher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create safe student creation function
CREATE OR REPLACE FUNCTION public.create_student_profile(
    student_email TEXT,
    student_name TEXT,
    student_class_id UUID,
    visual_password_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_student_id UUID;
BEGIN
    -- Only allow if current user is admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can create student profiles';
    END IF;

    -- Generate new UUID for student
    new_student_id := gen_random_uuid();

    -- Insert the profile record (bypassing RLS due to SECURITY DEFINER)
    INSERT INTO public.profiles (id, email, full_name, role, class_id, visual_password_id, is_active)
    VALUES (new_student_id, student_email, student_name, 'student', student_class_id, visual_password_id, true);
    
    RETURN new_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_teacher_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_profile TO authenticated;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check that policies are now simple and safe
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;