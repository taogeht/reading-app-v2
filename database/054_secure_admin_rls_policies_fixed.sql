-- Secure Admin RLS Policies (FIXED VERSION)
-- This migration creates secure admin access without infinite recursion
-- FIXES: Properly drops existing functions to avoid conflicts

-- ===================================================================
-- STEP 0: CLEANUP EXISTING FUNCTIONS
-- ===================================================================

-- Drop any existing admin check functions to avoid conflicts
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_admin(UUID);
DROP FUNCTION IF EXISTS public.is_teacher_or_admin();
DROP FUNCTION IF EXISTS public.is_teacher_or_admin(UUID);
DROP FUNCTION IF EXISTS public.generate_secure_password(INTEGER);
DROP FUNCTION IF EXISTS public.admin_create_teacher_with_username(VARCHAR, TEXT, TEXT);

-- ===================================================================
-- STEP 1: CREATE ADMIN CHECK FUNCTIONS
-- ===================================================================

-- Create a secure admin check function that doesn't cause recursion
-- This function checks admin status using auth metadata or direct auth table access
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- First try to get role from JWT claims (fastest)
    user_role := auth.jwt() ->> 'user_metadata' ->> 'role';
    
    IF user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Fallback: Check profiles table directly using auth.uid()
    -- This is safe because it doesn't create policy recursion
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
BEGIN
    -- Check JWT claims first
    user_role := auth.jwt() ->> 'user_metadata' ->> 'role';
    
    IF user_role IN ('admin', 'teacher') THEN
        RETURN TRUE;
    END IF;
    
    -- Fallback: Check profiles table
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
-- STEP 2: DROP EXISTING PROBLEMATIC POLICIES
-- ===================================================================

-- Clean up any existing policies that might conflict
DROP POLICY IF EXISTS "Admin users can access all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can access all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can read students in their classes" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read basic profile data" ON public.profiles;

DROP POLICY IF EXISTS "Admin users can access all classes" ON public.classes;
DROP POLICY IF EXISTS "Admin can access all classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can read own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can access own classes" ON public.classes;
DROP POLICY IF EXISTS "Students can read their class" ON public.classes;

DROP POLICY IF EXISTS "Admin users can access all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admin can access all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can access own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Students can read published assignments in their class" ON public.assignments;

-- Handle recordings table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'recordings' AND schemaname = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admin users can access all recordings" ON public.recordings';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can access all recordings" ON public.recordings';
        EXECUTE 'DROP POLICY IF EXISTS "Students can access own recordings" ON public.recordings';
        EXECUTE 'DROP POLICY IF EXISTS "Teachers can access recordings in their classes" ON public.recordings';
    END IF;
END $$;

-- ===================================================================
-- STEP 3: CREATE SECURE ADMIN RLS POLICIES
-- ===================================================================

-- PROFILES TABLE POLICIES
CREATE POLICY "Admin can access all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin());

CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Teachers can read students in their classes"
ON public.profiles FOR SELECT
TO authenticated
USING (
    public.is_teacher_or_admin() AND (
        role = 'student' AND class_id IN (
            SELECT id FROM public.classes WHERE teacher_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- CLASSES TABLE POLICIES
CREATE POLICY "Admin can access all classes"
ON public.classes FOR ALL
TO authenticated
USING (public.is_admin());

CREATE POLICY "Teachers can access own classes"
ON public.classes FOR ALL
TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "Students can read their class"
ON public.classes FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT class_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'student'
    )
);

-- ASSIGNMENTS TABLE POLICIES
CREATE POLICY "Admin can access all assignments"
ON public.assignments FOR ALL
TO authenticated
USING (public.is_admin());

CREATE POLICY "Teachers can access own assignments"
ON public.assignments FOR ALL
TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "Students can read published assignments in their class"
ON public.assignments FOR SELECT
TO authenticated
USING (
    is_published = true AND class_id IN (
        SELECT class_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'student'
    )
);

-- RECORDINGS TABLE POLICIES (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'recordings' AND schemaname = 'public') THEN
        -- Create new policies
        EXECUTE 'CREATE POLICY "Admin can access all recordings"
                 ON public.recordings FOR ALL
                 TO authenticated
                 USING (public.is_admin())';
                 
        EXECUTE 'CREATE POLICY "Students can access own recordings"
                 ON public.recordings FOR ALL
                 TO authenticated
                 USING (student_id = auth.uid())';
                 
        EXECUTE 'CREATE POLICY "Teachers can access recordings in their classes"
                 ON public.recordings FOR SELECT
                 TO authenticated
                 USING (
                     assignment_id IN (
                         SELECT id FROM public.assignments WHERE teacher_id = auth.uid()
                     )
                 )';
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
    -- Check if user is admin
    IF NOT public.is_admin() THEN
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
-- VERIFICATION QUERIES
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
AND tablename IN ('profiles', 'classes', 'assignments', 'recordings')
ORDER BY tablename;

-- Show all policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ===================================================================
-- SUCCESS MESSAGE
-- ===================================================================

SELECT 'Secure admin RLS policies created successfully!' AS status;