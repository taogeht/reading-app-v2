-- OPTIMIZE PROFILE FETCHING: Create a new, more efficient function to fetch profile data.

-- =============================================================================
-- STEP 1: CREATE THE NEW, OPTIMIZED FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_profile_fast(user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    role TEXT,
    class_id UUID
) AS $$
BEGIN
    -- This function is optimized for speed and only fetches essential data.
    -- It bypasses RLS by running with the privileges of the user who defined it.
    RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.role, p.class_id
    FROM public.profiles p
    WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_profile_fast TO authenticated;

-- =============================================================================
-- STEP 2: VERIFICATION
-- =============================================================================

SELECT 'New, optimized function created.' as final_status;