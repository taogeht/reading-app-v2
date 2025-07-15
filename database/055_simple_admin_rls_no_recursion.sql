-- Simple Admin RLS Policies (NO RECURSION VERSION)
-- This migration creates secure admin access without any recursion issues
-- STRATEGY: Use ONLY auth.uid() and JWT claims, avoid profile table lookups in policies

-- ===================================================================
-- STEP 0: DROP ALL DEPENDENT POLICIES FIRST
-- ===================================================================

-- Drop policies that depend on existing is_admin functions
-- This must be done before dropping the functions

-- PROFILES TABLE POLICIES
DROP POLICY IF EXISTS "Admin users can access all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can access all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can read students in their classes" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read basic profile data" ON public.profiles;

-- CLASSES TABLE POLICIES
DROP POLICY IF EXISTS "Admin users can access all classes" ON public.classes;
DROP POLICY IF EXISTS "Admin can access all classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can read own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can access own classes" ON public.classes;
DROP POLICY IF EXISTS "Students can read their class" ON public.classes;

-- ASSIGNMENTS TABLE POLICIES
DROP POLICY IF EXISTS "Admin users can access all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admin can access all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can access own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Students can read published assignments in their class" ON public.assignments;

-- RECORDINGS TABLE POLICIES (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'recordings' AND schemaname = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admin users can access all recordings" ON public.recordings';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can access all recordings" ON public.recordings';
        EXECUTE 'DROP POLICY IF EXISTS "Students can access own recordings" ON public.recordings';
        EXECUTE 'DROP POLICY IF EXISTS "Teachers can access recordings in their classes" ON public.recordings';
    END IF;
END $$;

-- VISUAL PASSWORDS TABLE POLICIES (this is what was causing the dependency error)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'visual_passwords' AND schemaname = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admin manage visual passwords" ON public.visual_passwords';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can access all visual passwords" ON public.visual_passwords';
        EXECUTE 'DROP POLICY IF EXISTS "Students can read visual passwords" ON public.visual_passwords';
        EXECUTE 'DROP POLICY IF EXISTS "Public can read visual passwords" ON public.visual_passwords';
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can read visual passwords" ON public.visual_passwords';
    END IF;
END $$;

-- CLASS SESSIONS TABLE POLICIES (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'class_sessions' AND schemaname = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admin can access all class sessions" ON public.class_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "Teachers can access own class sessions" ON public.class_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "Students can access their class sessions" ON public.class_sessions';
    END IF;
END $$;

-- RECORDING SUBMISSIONS TABLE POLICIES (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'recording_submissions' AND schemaname = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admin users can access all recording submissions" ON public.recording_submissions';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can access all recording submissions" ON public.recording_submissions';
        EXECUTE 'DROP POLICY IF EXISTS "Students can access own recording submissions" ON public.recording_submissions';
        EXECUTE 'DROP POLICY IF EXISTS "Teachers can access recording submissions in their classes" ON public.recording_submissions';
    END IF;
END $$;

-- ===================================================================
-- STEP 1: DROP EXISTING FUNCTIONS (now safe after dropping policies)
-- ===================================================================

-- Now we can safely drop the functions since no policies depend on them
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_admin(UUID);
DROP FUNCTION IF EXISTS public.is_teacher_or_admin();
DROP FUNCTION IF EXISTS public.is_teacher_or_admin(UUID);
DROP FUNCTION IF EXISTS public.generate_secure_password(INTEGER);
DROP FUNCTION IF EXISTS public.admin_create_teacher_with_username(VARCHAR, TEXT, TEXT);

-- ===================================================================
-- STEP 2: CREATE SIMPLE ADMIN CHECK FUNCTIONS (JWT ONLY)
-- ===================================================================

-- Create a simple admin check function that ONLY uses JWT claims
-- NO PROFILE TABLE LOOKUPS to avoid recursion
CREATE OR REPLACE FUNCTION public.is_admin_jwt_only()
RETURNS BOOLEAN AS $$
DECLARE
    jwt_claims JSONB;
    user_role TEXT;
BEGIN
    -- Only check JWT claims - no profile table access to avoid recursion
    jwt_claims := auth.jwt();
    IF jwt_claims IS NOT NULL THEN
        user_role := jwt_claims -> 'user_metadata' ->> 'role';
        RETURN COALESCE(user_role = 'admin', FALSE);
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check if user is teacher or admin (JWT ONLY)
CREATE OR REPLACE FUNCTION public.is_teacher_or_admin_jwt_only()
RETURNS BOOLEAN AS $$
DECLARE
    jwt_claims JSONB;
    user_role TEXT;
BEGIN
    -- Only check JWT claims - no profile table access to avoid recursion
    jwt_claims := auth.jwt();
    IF jwt_claims IS NOT NULL THEN
        user_role := jwt_claims -> 'user_metadata' ->> 'role';
        RETURN COALESCE(user_role IN ('admin', 'teacher'), FALSE);
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin_jwt_only() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_or_admin_jwt_only() TO authenticated, anon;

-- ===================================================================
-- STEP 3: CREATE VERY SIMPLE RLS POLICIES (NO PROFILE LOOKUPS)
-- ===================================================================

-- PROFILES TABLE POLICIES (Super simple - no recursion)
CREATE POLICY "Admin can access all profiles via JWT"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin_jwt_only());

CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- CLASSES TABLE POLICIES (Super simple - no recursion)
CREATE POLICY "Admin can access all classes via JWT"
ON public.classes FOR ALL
TO authenticated
USING (public.is_admin_jwt_only());

CREATE POLICY "Teachers can access own classes"
ON public.classes FOR ALL
TO authenticated
USING (teacher_id = auth.uid());

-- ASSIGNMENTS TABLE POLICIES (Super simple - no recursion)
CREATE POLICY "Admin can access all assignments via JWT"
ON public.assignments FOR ALL
TO authenticated
USING (public.is_admin_jwt_only());

CREATE POLICY "Teachers can access own assignments"
ON public.assignments FOR ALL
TO authenticated
USING (teacher_id = auth.uid());

-- RECORDINGS TABLE POLICIES (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'recordings' AND schemaname = 'public') THEN
        EXECUTE 'CREATE POLICY "Admin can access all recordings via JWT"
                 ON public.recordings FOR ALL
                 TO authenticated
                 USING (public.is_admin_jwt_only())';
                 
        EXECUTE 'CREATE POLICY "Students can access own recordings"
                 ON public.recordings FOR ALL
                 TO authenticated
                 USING (student_id = auth.uid())';
    END IF;
END $$;

-- VISUAL PASSWORDS TABLE POLICIES (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'visual_passwords' AND schemaname = 'public') THEN
        EXECUTE 'CREATE POLICY "Admin can access all visual passwords via JWT"
                 ON public.visual_passwords FOR ALL
                 TO authenticated
                 USING (public.is_admin_jwt_only())';
                 
        EXECUTE 'CREATE POLICY "Anyone can read visual passwords"
                 ON public.visual_passwords FOR SELECT
                 TO authenticated, anon
                 USING (true)';
    END IF;
END $$;

-- ===================================================================
-- STEP 4: CREATE SECURE PASSWORD GENERATION FUNCTION
-- ===================================================================

-- Create a secure password generation function on the database
CREATE OR REPLACE FUNCTION public.generate_secure_password(length INTEGER DEFAULT 12)
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    result TEXT := '';
    i INTEGER;
    char_index INTEGER;
BEGIN
    -- Validate input
    IF length < 8 OR length > 128 THEN
        RAISE EXCEPTION 'Password length must be between 8 and 128 characters';
    END IF;
    
    -- Generate random password
    FOR i IN 1..length LOOP
        char_index := 1 + (random() * (length(chars) - 1))::INTEGER;
        result := result || substr(chars, char_index, 1);
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.generate_secure_password(INTEGER) TO authenticated;

-- ===================================================================
-- STEP 5: CREATE ADMIN USER CREATION FUNCTION
-- ===================================================================

-- Create a secure function for admin to create teachers (to be called from frontend)
CREATE OR REPLACE FUNCTION public.admin_create_teacher_with_username(
    p_username VARCHAR(50),
    p_full_name TEXT,
    p_email TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    generated_password TEXT;
    fake_email TEXT;
    new_user_id UUID;
    result JSON;
BEGIN
    -- Check if user is admin (JWT only - no recursion)
    IF NOT public.is_admin_jwt_only() THEN
        RAISE EXCEPTION 'Only admin users can create teachers';
    END IF;
    
    -- Generate secure password
    generated_password := public.generate_secure_password(12);
    
    -- Create fake email if none provided
    IF p_email IS NULL THEN
        fake_email := p_username || '@teacherlogin.internal';
    ELSE
        fake_email := p_email;
    END IF;
    
    -- Check if username already exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username) THEN
        RAISE EXCEPTION 'Username already exists: %', p_username;
    END IF;
    
    -- Generate new UUID for user
    new_user_id := gen_random_uuid();
    
    -- Insert into profiles table (auth user creation handled separately)
    INSERT INTO public.profiles (
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        p_username,
        fake_email,
        p_full_name,
        'teacher',
        true,
        NOW(),
        NOW()
    );
    
    -- Return the results
    result := json_build_object(
        'user_id', new_user_id,
        'username', p_username,
        'password', generated_password,
        'email', fake_email,
        'message', 'Teacher profile created. Auth user must be created separately via admin API.'
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION public.admin_create_teacher_with_username(VARCHAR, TEXT, TEXT) TO authenticated;

-- ===================================================================
-- STEP 6: CREATE FRONTEND-SAFE ADMIN CHECK FUNCTIONS
-- ===================================================================

-- Create functions for frontend to use that check both JWT and profile table
-- These are SEPARATE from the policy functions to avoid recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    jwt_claims JSONB;
BEGIN
    -- First try to get role from JWT claims (fastest)
    jwt_claims := auth.jwt();
    IF jwt_claims IS NOT NULL THEN
        user_role := jwt_claims -> 'user_metadata' ->> 'role';
        IF user_role = 'admin' THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Fallback: Check profiles table directly using auth.uid()
    -- This is safe for frontend calls because it's not used in policies
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_active = true;
    
    RETURN COALESCE(user_role = 'admin', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check if user is teacher or admin
CREATE OR REPLACE FUNCTION public.is_teacher_or_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    jwt_claims JSONB;
BEGIN
    -- Check JWT claims first
    jwt_claims := auth.jwt();
    IF jwt_claims IS NOT NULL THEN
        user_role := jwt_claims -> 'user_metadata' ->> 'role';
        IF user_role IN ('admin', 'teacher') THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Fallback: Check profiles table
    -- This is safe for frontend calls because it's not used in policies
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_active = true;
    
    RETURN COALESCE(user_role IN ('admin', 'teacher'), FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_or_admin() TO authenticated, anon;

-- ===================================================================
-- VERIFICATION AND SUCCESS
-- ===================================================================

-- Test the admin check function
SELECT 
    'Testing admin check function' AS test,
    public.is_admin() AS is_current_user_admin;

-- Verify RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'classes', 'assignments', 'recordings', 'visual_passwords', 'class_sessions', 'recording_submissions')
ORDER BY tablename;

-- Show count of policies created
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ===================================================================
-- SUCCESS MESSAGE
-- ===================================================================

SELECT 'Simple admin RLS policies created successfully! No recursion possible.' AS status;