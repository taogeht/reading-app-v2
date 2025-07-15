-- FIX RLS Permission Errors - Replace auth.users queries with safe functions
-- This fixes "permission denied for table users" errors

-- =============================================================================
-- STEP 1: DROP PROBLEMATIC POLICIES THAT ACCESS auth.users DIRECTLY
-- =============================================================================

-- Drop all policies that directly access auth.users table
DROP POLICY IF EXISTS "Admin access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin access to classes" ON public.classes;
DROP POLICY IF EXISTS "Admin access to assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admin access to recordings" ON public.recordings;
DROP POLICY IF EXISTS "Admin insert visual passwords" ON public.visual_passwords;
DROP POLICY IF EXISTS "Admin update visual passwords" ON public.visual_passwords;
DROP POLICY IF EXISTS "Admin delete visual passwords" ON public.visual_passwords;
DROP POLICY IF EXISTS "Admin access to class sessions" ON public.class_sessions;

-- =============================================================================
-- STEP 2: CREATE SAFE POLICIES USING EXISTING SAFE FUNCTIONS
-- =============================================================================

-- PROFILES TABLE POLICIES (using safe functions)
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

-- CLASSES TABLE POLICIES (using safe functions)
CREATE POLICY "Admin access to classes" ON public.classes
    FOR ALL USING (public.is_admin());

CREATE POLICY "Teacher own classes" ON public.classes
    FOR ALL USING (
        public.is_teacher() 
        AND teacher_id = auth.uid()
    );

CREATE POLICY "Teacher view all classes" ON public.classes
    FOR SELECT USING (public.is_teacher());

-- ASSIGNMENTS TABLE POLICIES (using safe functions)
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

-- RECORDINGS TABLE POLICIES (using safe functions)
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

-- VISUAL PASSWORDS TABLE POLICIES (using safe functions)
CREATE POLICY "Admin insert visual passwords" ON public.visual_passwords
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admin update visual passwords" ON public.visual_passwords
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admin delete visual passwords" ON public.visual_passwords
    FOR DELETE USING (public.is_admin());

-- CLASS SESSIONS TABLE POLICIES (using safe functions)
CREATE POLICY "Admin access to class sessions" ON public.class_sessions
    FOR ALL USING (public.is_admin());

CREATE POLICY "Teacher view class sessions" ON public.class_sessions
    FOR SELECT USING (
        public.is_teacher()
        AND class_id IN (
            SELECT id FROM public.classes 
            WHERE teacher_id = auth.uid()
        )
    );

CREATE POLICY "Student own sessions" ON public.class_sessions
    FOR ALL USING (
        public.get_user_role() = 'student'
        AND student_name = (
            SELECT full_name FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- =============================================================================
-- STEP 3: ENSURE ALL SAFE FUNCTIONS EXIST AND HAVE PROPER PERMISSIONS
-- =============================================================================

-- Grant execute permissions on all safe functions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_teacher_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_profile TO authenticated;

-- Grant execute on admin helper functions if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_get_all_profiles') THEN
        GRANT EXECUTE ON FUNCTION public.admin_get_all_profiles TO authenticated;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_get_classes_with_counts') THEN
        GRANT EXECUTE ON FUNCTION public.admin_get_classes_with_counts TO authenticated;
    END IF;
END $$;

-- =============================================================================
-- STEP 4: VERIFICATION
-- =============================================================================

-- Check that all policies are now using safe functions
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
        WHEN qual LIKE '%auth.users%' THEN 'UNSAFE (uses auth.users - needs fixing)'
        ELSE 'REVIEW NEEDED'
    END as safety_status
FROM pg_policies 
WHERE schemaname = 'public'
    AND policyname NOT LIKE '%old%'
ORDER BY tablename, policyname;

-- Check that safe functions exist
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

SELECT 'RLS policies have been updated to use safe functions!' as status;