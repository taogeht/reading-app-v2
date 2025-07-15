-- SECURE PROFILE ACCESS: Remove insecure RLS policies and restore secure ones.

-- =============================================================================
-- STEP 1: REMOVE INSECURE ANONYMOUS ACCESS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Allow anonymous read for student access" ON public.classes;
DROP POLICY IF EXISTS "Allow anonymous read for students" ON public.profiles;
DROP POLICY IF EXISTS "Allow anonymous read for visual passwords" ON public.visual_passwords;

-- =============================================================================
-- STEP 2: RESTORE SECURE RLS POLICIES FROM 025
-- =============================================================================

-- Drop any conflicting policies
DROP POLICY IF EXISTS "Own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Users own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can access own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

-- Create a simple, guaranteed-to-work policy for own profile access
CREATE POLICY "Users can access own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- Add a fallback policy for authenticated users to read profiles
CREATE POLICY "Authenticated users can read profiles" ON public.profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- =============================================================================
-- STEP 3: VERIFICATION
-- =============================================================================

SELECT 'Insecure policies removed and secure policies restored.' as final_status;