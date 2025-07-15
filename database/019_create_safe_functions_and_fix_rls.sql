-- CREATE SAFE FUNCTIONS AND FIX RLS POLICIES
-- This creates all required safe functions first, then fixes the RLS policies

-- =============================================================================
-- STEP 1: CREATE ALL REQUIRED SAFE FUNCTIONS
-- =============================================================================

-- Create safe function to check admin status
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

-- Create safe function to check teacher status
CREATE OR REPLACE FUNCTION public.is_teacher(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = user_id 
        AND raw_user_meta_data->>'role' = 'teacher'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create safe function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT raw_user_meta_data->>'role' 
        FROM auth.users 
        WHERE id = user_id
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

-- Safe function to get all profiles for admin
CREATE OR REPLACE FUNCTION public.admin_get_all_profiles()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    role TEXT,
    class_id UUID,
    visual_password_id TEXT,
    is_active BOOLEAN,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can access all profiles';
    END IF;

    RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.role, p.class_id, p.visual_password_id, 
           p.is_active, p.last_accessed_at, p.created_at, p.updated_at
    FROM public.profiles p
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe function to get class with student count
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
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can access all classes';
    END IF;

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
-- STEP 2: GRANT EXECUTE PERMISSIONS
-- =============================================================================

-- Grant execute permissions on all safe functions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_teacher_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_classes_with_counts TO authenticated;

-- =============================================================================
-- STEP 3: DROP PROBLEMATIC POLICIES THAT ACCESS auth.users DIRECTLY
-- =============================================================================

-- Drop all policies that directly access auth.users table
DROP POLICY IF EXISTS "Admin access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Teacher view students" ON public.profiles;

DROP POLICY IF EXISTS "Admin access to classes" ON public.classes;
DROP POLICY IF EXISTS "Admin full access to classes" ON public.classes;
DROP POLICY IF EXISTS "Teacher own classes" ON public.classes;
DROP POLICY IF EXISTS "Teacher view all classes" ON public.classes;

DROP POLICY IF EXISTS "Admin access to assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admin full access to assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teacher manage assignments" ON public.assignments;
DROP POLICY IF EXISTS "Student view assignments" ON public.assignments;

DROP POLICY IF EXISTS "Admin access to recordings" ON public.recordings;
DROP POLICY IF EXISTS "Admin full access to recordings" ON public.recordings;
DROP POLICY IF EXISTS "Teacher view recordings" ON public.recordings;
DROP POLICY IF EXISTS "Student own recordings" ON public.recordings;

DROP POLICY IF EXISTS "Admin insert visual passwords" ON public.visual_passwords;
DROP POLICY IF EXISTS "Admin update visual passwords" ON public.visual_passwords;
DROP POLICY IF EXISTS "Admin delete visual passwords" ON public.visual_passwords;
DROP POLICY IF EXISTS "Admin manage visual passwords" ON public.visual_passwords;
DROP POLICY IF EXISTS "Public read visual passwords" ON public.visual_passwords;

DROP POLICY IF EXISTS "Admin access to class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Teacher view class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Student own sessions" ON public.class_sessions;

-- =============================================================================
-- STEP 4: CREATE SAFE POLICIES USING THE NEW SAFE FUNCTIONS
-- =============================================================================

-- PROFILES TABLE POLICIES
CREATE POLICY "Admin access to profiles" ON public.profiles
    FOR ALL USING (public.is_admin());

CREATE POLICY "Own profile access" ON public.profiles
    FOR ALL USING (auth.uid() = id);

CREATE POLICY "Teacher view students" ON public.profiles
    FOR SELECT USING (
        public.is_teacher() 
        AND role = 'student' 
        AND class_id IN (
            SELECT id FROM public.classes 
            WHERE teacher_id = auth.uid()
        )
    );

-- CLASSES TABLE POLICIES
CREATE POLICY "Admin access to classes" ON public.classes
    FOR ALL USING (public.is_admin());

CREATE POLICY "Teacher own classes" ON public.classes
    FOR ALL USING (
        public.is_teacher() 
        AND teacher_id = auth.uid()
    );

CREATE POLICY "Teacher view all classes" ON public.classes
    FOR SELECT USING (public.is_teacher());

-- ASSIGNMENTS TABLE POLICIES
CREATE POLICY "Admin access to assignments" ON public.assignments
    FOR ALL USING (public.is_admin());

CREATE POLICY "Teacher manage assignments" ON public.assignments
    FOR ALL USING (
        public.is_teacher() 
        AND teacher_id = auth.uid()
    );

CREATE POLICY "Student view assignments" ON public.assignments
    FOR SELECT USING (
        public.get_user_role() = 'student'
        AND is_published = true
        AND class_id = (
            SELECT class_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- RECORDINGS TABLE POLICIES
CREATE POLICY "Admin access to recordings" ON public.recordings
    FOR ALL USING (public.is_admin());

CREATE POLICY "Teacher view recordings" ON public.recordings
    FOR SELECT USING (
        public.is_teacher()
        AND assignment_id IN (
            SELECT id FROM public.assignments 
            WHERE teacher_id = auth.uid()
        )
    );

CREATE POLICY "Student own recordings" ON public.recordings
    FOR ALL USING (
        public.get_user_role() = 'student'
        AND student_id = auth.uid()
    );

-- VISUAL PASSWORDS TABLE POLICIES
CREATE POLICY "Public read visual passwords" ON public.visual_passwords
    FOR SELECT USING (true);

CREATE POLICY "Admin insert visual passwords" ON public.visual_passwords
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admin update visual passwords" ON public.visual_passwords
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admin delete visual passwords" ON public.visual_passwords
    FOR DELETE USING (public.is_admin());

-- CLASS SESSIONS TABLE POLICIES (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_sessions') THEN
        EXECUTE 'CREATE POLICY "Admin access to class sessions" ON public.class_sessions FOR ALL USING (public.is_admin())';
        
        EXECUTE 'CREATE POLICY "Teacher view class sessions" ON public.class_sessions FOR SELECT USING (
            public.is_teacher()
            AND class_id IN (
                SELECT id FROM public.classes 
                WHERE teacher_id = auth.uid()
            )
        )';
        
        EXECUTE 'CREATE POLICY "Student own sessions" ON public.class_sessions FOR ALL USING (
            public.get_user_role() = ''student''
            AND student_name = (
                SELECT full_name FROM public.profiles 
                WHERE id = auth.uid()
            )
        )';
    END IF;
END $$;

-- =============================================================================
-- STEP 5: VERIFICATION
-- =============================================================================

-- Check that all safe functions exist
SELECT 'Created safe functions:' as info;
SELECT 
    proname as function_name,
    CASE 
        WHEN proname IN ('is_admin', 'is_teacher', 'get_user_role') THEN 'CRITICAL SAFE FUNCTION'
        WHEN proname LIKE 'admin_%' THEN 'ADMIN HELPER FUNCTION'
        WHEN proname LIKE 'create_%_profile' THEN 'PROFILE CREATION FUNCTION'
        ELSE 'OTHER'
    END as function_type
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND proname IN ('is_admin', 'is_teacher', 'get_user_role', 'create_teacher_profile', 'create_student_profile', 'admin_get_all_profiles', 'admin_get_classes_with_counts')
ORDER BY function_type, proname;

-- Check that all policies are now using safe functions
SELECT 'Policy safety check:' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%public.is_admin%' THEN 'SAFE (uses is_admin function)'
        WHEN qual LIKE '%public.is_teacher%' THEN 'SAFE (uses is_teacher function)'
        WHEN qual LIKE '%public.get_user_role%' THEN 'SAFE (uses get_user_role function)'
        WHEN qual LIKE '%auth.uid() = id%' THEN 'SAFE (own record access)'
        WHEN qual = 'true' THEN 'SAFE (public read)'
        WHEN qual LIKE '%auth.users%' THEN 'UNSAFE (uses auth.users - needs fixing)'
        ELSE 'REVIEW NEEDED'
    END as safety_status
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT 'All safe functions created and RLS policies updated!' as final_status;