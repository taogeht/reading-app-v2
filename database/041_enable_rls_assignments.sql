-- Fix RLS Policy Issues - Phase 2: Re-enable RLS on Assignments Table
-- This migration re-enables RLS on the assignments table with simple, non-recursive policies

-- ===================================================================
-- STEP 1: RE-ENABLE RLS ON ASSIGNMENTS TABLE
-- ===================================================================

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- STEP 2: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ===================================================================

-- Policy 1: Teachers can manage assignments for their classes
-- This uses a simple subquery to check if the teacher owns the class
-- Note: We avoid joins to prevent recursion, using EXISTS instead
CREATE POLICY "Teachers can manage class assignments" ON public.assignments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.classes 
            WHERE classes.id = assignments.class_id 
            AND classes.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.classes 
            WHERE classes.id = assignments.class_id 
            AND classes.teacher_id = auth.uid()
        )
    );

-- Policy 2: Service role has full access (for admin operations)
-- This allows the application to perform admin operations via service role
CREATE POLICY "Service role full access to assignments" ON public.assignments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 3: Anonymous users can read published assignments
-- Students access assignments via visual passwords (anonymous authentication)
-- This is safe because it only allows reading published assignments
CREATE POLICY "Anonymous users can read published assignments" ON public.assignments
    FOR SELECT
    TO anon
    USING (is_published = true);

-- Policy 4: Authenticated users can read published assignments
-- This allows teachers to see published assignments from other classes
CREATE POLICY "Authenticated users can read published assignments" ON public.assignments
    FOR SELECT
    TO authenticated
    USING (is_published = true);

-- ===================================================================
-- STEP 3: GRANT NECESSARY PERMISSIONS
-- ===================================================================

-- Grant basic table permissions
-- Note: RLS policies will control actual access
GRANT SELECT ON public.assignments TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check that RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'assignments' AND schemaname = 'public';

-- Check the policies that were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'assignments' AND schemaname = 'public';

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
This migration completes Phase 2.3 of the RLS Policy Fix Plan for assignments:

POLICIES CREATED:
1. "Teachers can manage class assignments" - Teachers can manage assignments for their classes
2. "Service role full access to assignments" - Admin operations via service role
3. "Anonymous users can read published assignments" - Students can view published assignments
4. "Authenticated users can read published assignments" - Teachers can see published assignments

KEY FEATURES:
- Uses EXISTS subqueries instead of joins to prevent recursion
- Simple policies that check direct column values and single-level subqueries
- Service role access for admin operations
- Anonymous access for student visual password authentication
- Supports the application's assignment management flow

SECURITY MODEL:
- Teachers can only manage assignments for classes they own
- Students (anonymous) can only read published assignments
- Admin operations handled via service role in application layer
- No complex joins that could cause recursion
- Published assignments are readable by everyone (appropriate for educational content)
*/