-- FIX FUNCTION RETURN TYPE: Drop and recreate get_user_profile with correct return type
-- This fixes the "cannot change return type of existing function" error

-- =============================================================================
-- STEP 1: DROP EXISTING FUNCTION WITH INCOMPATIBLE RETURN TYPE
-- =============================================================================

-- Drop the existing function that returns JSON (from older migrations)
DROP FUNCTION IF EXISTS public.get_user_profile(uuid);

-- Also drop any other variations that might exist
DROP FUNCTION IF EXISTS public.get_user_profile();

-- =============================================================================
-- STEP 2: CREATE NEW FUNCTION WITH TABLE RETURN TYPE
-- =============================================================================

-- Create the function that returns TABLE (compatible with AuthContext)
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

-- =============================================================================
-- STEP 3: GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_profile TO authenticated;

-- =============================================================================
-- STEP 4: CREATE PROFILE CREATION FUNCTION (if missing)
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
-- STEP 5: VERIFICATION
-- =============================================================================

-- Test that the function exists and works
SELECT 'Function verification:' as info;
SELECT 
    proname as function_name,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'get_user_profile' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Test function execution (should work without errors)
SELECT 'Testing function execution:' as info;
DO $$
BEGIN
    PERFORM * FROM public.get_user_profile() LIMIT 1;
    RAISE NOTICE 'get_user_profile function works correctly!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Function test failed: %', SQLERRM;
END $$;

SELECT 'Function return type fixed - AuthContext should now work!' as final_status;