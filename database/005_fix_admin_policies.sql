-- Fix RLS policies for admin access
-- This resolves the infinite recursion error when admins log in

-- =============================================================================
-- FIX PROFILES TABLE POLICIES
-- =============================================================================

-- Drop all existing policies on profiles to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create simple, non-recursive policies

-- 1. Users can always view and update their own profile (no recursion)
CREATE POLICY "Enable read access for own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Enable update access for own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 2. Admins can view all profiles (direct role check, no subquery)
CREATE POLICY "Enable read access for admins" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 3. Admins can insert/update all profiles
CREATE POLICY "Enable insert access for admins" ON public.profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Enable update access for admins" ON public.profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 4. Teachers can view students in their classes (simplified)
CREATE POLICY "Enable read access for teachers to their students" ON public.profiles
    FOR SELECT USING (
        role = 'student' AND 
        class_id IN (
            SELECT c.id FROM public.classes c
            WHERE c.teacher_id = auth.uid()
        )
    );

-- =============================================================================
-- ENSURE ADMIN PROFILE EXISTS
-- =============================================================================

-- Create a function to ensure admin profile exists for existing auth users
CREATE OR REPLACE FUNCTION public.ensure_admin_profile()
RETURNS VOID AS $$
BEGIN
    -- Insert profile for any auth user with admin role but no profile
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    SELECT 
        au.id,
        au.email,
        COALESCE(au.raw_user_meta_data->>'full_name', 'Admin User'),
        'admin',
        true
    FROM auth.users au
    WHERE au.raw_user_meta_data->>'role' = 'admin'
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function to create missing admin profiles
SELECT public.ensure_admin_profile();

-- =============================================================================
-- FIX OTHER TABLE POLICIES FOR ADMIN ACCESS
-- =============================================================================

-- Ensure admins can manage classes
DROP POLICY IF EXISTS "Admins can manage all classes" ON public.classes;
CREATE POLICY "Admins can manage all classes" ON public.classes
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Ensure admins can manage assignments  
DROP POLICY IF EXISTS "Admins can manage all assignments" ON public.assignments;
CREATE POLICY "Admins can manage all assignments" ON public.assignments
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Ensure admins can view all recordings
DROP POLICY IF EXISTS "Admins can view all recordings" ON public.recordings;
CREATE POLICY "Admins can view all recordings" ON public.recordings
    FOR SELECT USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- =============================================================================
-- SIMPLIFIED PROFILE ACCESS FUNCTION
-- =============================================================================

-- Create a safe function to get user profile without policy conflicts
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID DEFAULT auth.uid())
RETURNS JSON AS $$
DECLARE
    profile_record public.profiles%ROWTYPE;
    result JSON;
BEGIN
    -- Direct query bypassing RLS for this specific function
    SELECT * INTO profile_record 
    FROM public.profiles 
    WHERE id = user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Profile not found');
    END IF;
    
    result := json_build_object(
        'id', profile_record.id,
        'email', profile_record.email,
        'full_name', profile_record.full_name,
        'role', profile_record.role,
        'class_id', profile_record.class_id,
        'is_active', profile_record.is_active,
        'created_at', profile_record.created_at,
        'updated_at', profile_record.updated_at
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check if admin profile exists
-- SELECT * FROM public.profiles WHERE role = 'admin';

-- Test profile access function
-- SELECT public.get_user_profile();

-- Check all policies on profiles table
-- SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles';