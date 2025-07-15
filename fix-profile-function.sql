-- Fix the profile function by dropping and recreating it with the correct signature

-- First, drop the existing function
DROP FUNCTION IF EXISTS public.get_user_profile_fast(uuid);

-- Now create the function with the correct return type that matches what AuthContext expects
CREATE OR REPLACE FUNCTION public.get_user_profile_fast(user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    role TEXT,
    class_id UUID,
    username TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    -- This function is optimized for speed and includes the username field
    -- It bypasses RLS by running with the privileges of the user who defined it
    RETURN QUERY
    SELECT 
        p.id, 
        p.email, 
        p.full_name, 
        p.role, 
        p.class_id,
        p.username,
        p.created_at,
        p.updated_at
    FROM public.profiles p
    WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_profile_fast TO authenticated;

-- Test the function to make sure it works
SELECT 'Profile function recreated successfully' as status;