-- Fix RLS Policy Issues - Phase 2: Re-enable RLS on Profiles Table
-- This migration re-enables RLS on the profiles table with simple, non-recursive policies

-- ===================================================================
-- STEP 1: RE-ENABLE RLS ON PROFILES TABLE
-- ===================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- STEP 2: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ===================================================================

-- Policy 1: Users can read their own profile
-- This policy only checks auth.uid() which is safe and doesn't cause recursion
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
-- Same simple check, no table references
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy 3: Service role has full access (for admin operations)
-- This allows the application to perform admin operations via service role
CREATE POLICY "Service role full access to profiles" ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 4: Authenticated users can insert their own profile
-- For profile creation during signup
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- ===================================================================
-- STEP 3: GRANT NECESSARY PERMISSIONS
-- ===================================================================

-- Grant basic table permissions
-- Note: RLS policies will control actual access
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check that RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- Check the policies that were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
This migration completes Phase 2.1 of the RLS Policy Fix Plan for profiles:

POLICIES CREATED:
1. "Users can read own profile" - Users can SELECT their own profile data
2. "Users can update own profile" - Users can UPDATE their own profile data  
3. "Service role full access to profiles" - Admin operations via service role
4. "Users can insert own profile" - Profile creation during signup

KEY FEATURES:
- Simple policies that only check auth.uid() = id
- No references to other tables (prevents infinite recursion)
- Service role access for admin operations
- Supports the application's authentication flow

SECURITY MODEL:
- Users can only access their own profile data
- Admin operations handled via service role in application layer
- No anonymous access (students use visual passwords, not auth.users)
*/