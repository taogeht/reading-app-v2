-- Safe RLS Policies Without Recursion
-- Run this AFTER the complete schema setup to implement secure, non-recursive policies

-- =============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER - BYPASS RLS)
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

-- =============================================================================
-- PROFILES TABLE POLICIES
-- =============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users own profile access" ON public.profiles;

-- Admin can do everything
CREATE POLICY "Admin access to profiles" ON public.profiles
    FOR ALL USING (public.is_admin());

-- Users can view and update their own profile
CREATE POLICY "Own profile access" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- Teachers can view students in their classes
CREATE POLICY "Teacher view students" ON public.profiles
    FOR SELECT USING (
        public.is_teacher() 
        AND role = 'student' 
        AND class_id IN (
            SELECT id FROM public.classes 
            WHERE teacher_id = auth.uid()
        )
    );

-- =============================================================================
-- CLASSES TABLE POLICIES
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admin full access to classes" ON public.classes;

-- Admin can do everything with classes
CREATE POLICY "Admin access to classes" ON public.classes
    FOR ALL USING (public.is_admin());

-- Teachers can view and update their own classes
CREATE POLICY "Teacher own classes" ON public.classes
    FOR ALL USING (
        public.is_teacher() 
        AND teacher_id = auth.uid()
    );

-- Teachers can view other classes (for context)
CREATE POLICY "Teacher view all classes" ON public.classes
    FOR SELECT USING (public.is_teacher());

-- =============================================================================
-- ASSIGNMENTS TABLE POLICIES
-- =============================================================================

-- Admin can do everything with assignments
CREATE POLICY "Admin access to assignments" ON public.assignments
    FOR ALL USING (public.is_admin());

-- Teachers can manage assignments for their classes
CREATE POLICY "Teacher manage assignments" ON public.assignments
    FOR ALL USING (
        public.is_teacher() 
        AND teacher_id = auth.uid()
    );

-- Students can view published assignments for their class
CREATE POLICY "Student view assignments" ON public.assignments
    FOR SELECT USING (
        public.get_user_role() = 'student'
        AND is_published = true
        AND class_id = (
            SELECT class_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- =============================================================================
-- RECORDINGS TABLE POLICIES
-- =============================================================================

-- Admin can view all recordings
CREATE POLICY "Admin access to recordings" ON public.recordings
    FOR ALL USING (public.is_admin());

-- Teachers can view recordings for their assignments
CREATE POLICY "Teacher view recordings" ON public.recordings
    FOR SELECT USING (
        public.is_teacher()
        AND assignment_id IN (
            SELECT id FROM public.assignments 
            WHERE teacher_id = auth.uid()
        )
    );

-- Students can manage their own recordings
CREATE POLICY "Student own recordings" ON public.recordings
    FOR ALL USING (
        public.get_user_role() = 'student'
        AND student_id = auth.uid()
    );

-- =============================================================================
-- VISUAL PASSWORDS TABLE POLICIES
-- =============================================================================

-- Everyone can read visual passwords (they're not sensitive)
CREATE POLICY "Public read visual passwords" ON public.visual_passwords
    FOR SELECT USING (true);

-- Only admins can modify visual passwords
CREATE POLICY "Admin manage visual passwords" ON public.visual_passwords
    FOR INSERT, UPDATE, DELETE USING (public.is_admin());

-- =============================================================================
-- CLASS SESSIONS TABLE POLICIES
-- =============================================================================

-- Admin can manage all class sessions
CREATE POLICY "Admin access to class sessions" ON public.class_sessions
    FOR ALL USING (public.is_admin());

-- Teachers can view sessions for their classes
CREATE POLICY "Teacher view class sessions" ON public.class_sessions
    FOR SELECT USING (
        public.is_teacher()
        AND class_id IN (
            SELECT id FROM public.classes 
            WHERE teacher_id = auth.uid()
        )
    );

-- Students can create and view their own sessions
CREATE POLICY "Student own sessions" ON public.class_sessions
    FOR ALL USING (
        public.get_user_role() = 'student'
        AND student_name = (
            SELECT full_name FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- =============================================================================
-- ADDITIONAL ADMIN HELPER FUNCTIONS
-- =============================================================================

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
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_teacher_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_classes_with_counts TO authenticated;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- List all policies to verify they're safe
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%public.is_admin%' THEN 'SAFE (uses function)'
        WHEN qual LIKE '%auth.users%' THEN 'SAFE (uses auth.users)'
        WHEN qual LIKE '%auth.uid() = id%' THEN 'SAFE (own record)'
        WHEN qual LIKE '%SELECT%FROM%public.profiles%' THEN 'POTENTIALLY UNSAFE (queries profiles)'
        ELSE 'REVIEW NEEDED'
    END as safety_status
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;