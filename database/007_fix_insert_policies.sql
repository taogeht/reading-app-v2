-- Fix RLS policies to prevent infinite recursion during profile creation
-- This resolves the issue when admins try to create new teacher/student profiles

-- =============================================================================
-- FIX INSERT POLICY FOR PROFILES
-- =============================================================================

-- Drop the problematic insert policy
DROP POLICY IF EXISTS "Enable insert access for admins" ON public.profiles;

-- Create a new insert policy that only checks auth.users metadata (no recursion)
CREATE POLICY "Enable insert access for admins" ON public.profiles
    FOR INSERT WITH CHECK (
        -- Check if the current user is admin via auth.users metadata
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow users to create their own profile (for signup)
        auth.uid() = id
    );

-- Update the read policy to be more efficient and avoid recursion
DROP POLICY IF EXISTS "Enable read access for admins" ON public.profiles;
CREATE POLICY "Enable read access for admins" ON public.profiles
    FOR SELECT USING (
        -- Check auth.users metadata first (fastest, no recursion)
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow users to read their own profile
        auth.uid() = id
        OR
        -- Check profile role as fallback (use EXISTS to avoid recursion)
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

-- Update the update policy similarly
DROP POLICY IF EXISTS "Enable update access for admins" ON public.profiles;
CREATE POLICY "Enable update access for admins" ON public.profiles
    FOR UPDATE USING (
        -- Check auth.users metadata first
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow users to update their own profile
        auth.uid() = id
        OR
        -- Check profile role as fallback
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

-- =============================================================================
-- UPDATE TEACHER CREATION FUNCTION
-- =============================================================================

-- Create a function to safely create teacher profiles with proper metadata
CREATE OR REPLACE FUNCTION public.create_teacher_profile(
    teacher_id UUID,
    teacher_email TEXT,
    teacher_name TEXT
)
RETURNS void AS $$
BEGIN
    -- Insert the profile record
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (teacher_id, teacher_email, teacher_name, 'teacher', true)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = 'teacher',
        is_active = true;
        
    -- Update the auth.users metadata to include teacher role
    UPDATE auth.users 
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "teacher"}'::jsonb
    WHERE id = teacher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_teacher_profile TO authenticated;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check current policies
-- SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles';

-- Test profile access
-- SELECT public.get_user_profile();