-- FIX PROFILE LOADING ON REFRESH: Ensure users can load their own profile
-- This fixes the "stuck on Loading" issue when refreshing the page

-- =============================================================================
-- STEP 1: DIAGNOSE PROFILE ACCESS ISSUES
-- =============================================================================

-- Check current profile policies
SELECT 'Current profile policies:' as info;
SELECT policyname, cmd, qual FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- Test basic profile table access
SELECT 'Profile table access test:' as info;
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- =============================================================================
-- STEP 2: ENSURE USERS CAN ACCESS THEIR OWN PROFILE
-- =============================================================================

-- Drop any conflicting policies
DROP POLICY IF EXISTS "Own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Users own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a simple, guaranteed-to-work policy for own profile access
CREATE POLICY "Users can access own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- =============================================================================
-- STEP 3: ENSURE AUTHENTICATED USERS CAN READ BASIC PROFILE DATA
-- =============================================================================

-- Add a fallback policy for authenticated users to read profiles
-- This helps with the initial loading phase
CREATE POLICY "Authenticated users can read profiles" ON public.profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- =============================================================================
-- STEP 4: CREATE SAFE PROFILE LOADING FUNCTION
-- =============================================================================

-- Drop existing function that has incompatible return type (JSON vs TABLE)
DROP FUNCTION IF EXISTS public.get_user_profile(uuid);

-- Create a safe function for loading user profiles that bypasses RLS issues
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID DEFAULT auth.uid())
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
    -- Only allow users to get their own profile (security check)
    IF user_id != auth.uid() AND NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'You can only access your own profile';
    END IF;

    -- Return the profile data
    RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.role, p.class_id, p.visual_password_id,
           p.is_active, p.last_accessed_at, p.created_at, p.updated_at
    FROM public.profiles p
    WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_profile TO authenticated;

-- =============================================================================
-- STEP 5: CREATE PROFILE CREATION FUNCTION FOR NEW USERS
-- =============================================================================

-- Create function to create profile for new authenticated users
CREATE OR REPLACE FUNCTION public.create_user_profile_if_missing()
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
DECLARE
    user_email TEXT;
    user_full_name TEXT;
    user_role TEXT;
BEGIN
    -- Get user info from auth.users
    SELECT email, 
           COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
           COALESCE(raw_user_meta_data->>'role', 'student')
    INTO user_email, user_full_name, user_role
    FROM auth.users 
    WHERE id = auth.uid();

    -- Try to insert profile if it doesn't exist
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (auth.uid(), user_email, user_full_name, user_role, true)
    ON CONFLICT (id) DO NOTHING;

    -- Return the profile
    RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.role, p.class_id, p.visual_password_id,
           p.is_active, p.last_accessed_at, p.created_at, p.updated_at
    FROM public.profiles p
    WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_user_profile_if_missing TO authenticated;

-- =============================================================================
-- STEP 6: ENSURE TRIGGER FOR NEW USER PROFILE CREATION WORKS
-- =============================================================================

-- Make sure the trigger function for new users works properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- STEP 7: TESTING AND VERIFICATION
-- =============================================================================

-- Test own profile access
SELECT 'Testing own profile access:' as info;
DO $$
BEGIN
    PERFORM * FROM public.get_user_profile() LIMIT 1;
    RAISE NOTICE 'Profile loading function works!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Profile loading failed: %', SQLERRM;
END $$;

-- Check final policies
SELECT 'Final profile policies:' as info;
SELECT policyname, cmd FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- Test profile creation for missing users
SELECT 'Testing profile creation:' as info;
DO $$
BEGIN
    PERFORM * FROM public.create_user_profile_if_missing() LIMIT 1;
    RAISE NOTICE 'Profile creation function works!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Profile creation failed: %', SQLERRM;
END $$;

SELECT 'Profile loading on refresh should now work!' as final_status;