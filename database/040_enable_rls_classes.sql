-- Fix RLS Policy Issues - Phase 2: Re-enable RLS on Classes Table
-- This migration re-enables RLS on the classes table with simple, non-recursive policies

-- ===================================================================
-- STEP 1: RE-ENABLE RLS ON CLASSES TABLE
-- ===================================================================

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- STEP 2: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ===================================================================

-- Policy 1: Teachers can manage their own classes
-- Simple check against teacher_id column
CREATE POLICY "Teachers can manage own classes" ON public.classes
    FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

-- Policy 2: Service role has full access (for admin operations)
-- This allows the application to perform admin operations via service role
CREATE POLICY "Service role full access to classes" ON public.classes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 3: Anonymous users can read classes (for student access)
-- Students access classes via visual passwords (anonymous authentication)
-- This is safe because it only allows reading, not modification
CREATE POLICY "Anonymous users can read classes" ON public.classes
    FOR SELECT
    TO anon
    USING (is_active = true);

-- Policy 4: Authenticated users can read all active classes
-- This allows teachers to see other classes for reference
CREATE POLICY "Authenticated users can read active classes" ON public.classes
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- ===================================================================
-- STEP 3: GRANT NECESSARY PERMISSIONS
-- ===================================================================

-- Grant basic table permissions
-- Note: RLS policies will control actual access
GRANT SELECT ON public.classes TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check that RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'classes' AND schemaname = 'public';

-- Check the policies that were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'classes' AND schemaname = 'public';

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
This migration completes Phase 2.2 of the RLS Policy Fix Plan for classes:

POLICIES CREATED:
1. "Teachers can manage own classes" - Teachers can manage classes they created
2. "Service role full access to classes" - Admin operations via service role
3. "Anonymous users can read classes" - Students can view classes via visual passwords
4. "Authenticated users can read active classes" - Teachers can see all active classes

KEY FEATURES:
- Simple policies that only check direct column values
- No references to other tables (prevents infinite recursion)
- Service role access for admin operations
- Anonymous access for student visual password authentication
- Supports the application's class management flow

SECURITY MODEL:
- Teachers can only manage their own classes
- Students (anonymous) can only read active classes
- Admin operations handled via service role in application layer
- No complex joins that could cause recursion
*/