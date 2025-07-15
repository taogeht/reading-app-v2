-- Fix RLS Policy Issues - Phase 2: Re-enable RLS on Class Sessions Table
-- This migration re-enables RLS on the class_sessions table with simple, non-recursive policies

-- ===================================================================
-- STEP 1: RE-ENABLE RLS ON CLASS_SESSIONS TABLE
-- ===================================================================

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- STEP 2: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ===================================================================

-- Policy 1: Teachers can manage sessions for their classes
-- Uses EXISTS to check if teacher owns the class
CREATE POLICY "Teachers can manage class sessions" ON public.class_sessions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.classes 
            WHERE classes.id = class_sessions.class_id 
            AND classes.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.classes 
            WHERE classes.id = class_sessions.class_id 
            AND classes.teacher_id = auth.uid()
        )
    );

-- Policy 2: Anonymous users can view non-expired sessions
-- Students need to access sessions via visual passwords (anonymous authentication)
-- Only allows viewing sessions that haven't expired for security
CREATE POLICY "Anonymous users can view non-expired sessions" ON public.class_sessions
    FOR SELECT
    TO anon
    USING (expires_at > now());

-- Policy 3: Authenticated users can view non-expired sessions
-- Teachers and other authenticated users can view non-expired sessions
CREATE POLICY "Authenticated users can view non-expired sessions" ON public.class_sessions
    FOR SELECT
    TO authenticated
    USING (expires_at > now());

-- Policy 4: Service role has full access (for admin operations)
CREATE POLICY "Service role full access to class_sessions" ON public.class_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===================================================================
-- STEP 3: GRANT NECESSARY PERMISSIONS
-- ===================================================================

-- Grant basic table permissions
-- Note: RLS policies will control actual access
GRANT SELECT ON public.class_sessions TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated;
GRANT ALL ON public.class_sessions TO service_role;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check that RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'class_sessions' AND schemaname = 'public';

-- Check the policies that were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'class_sessions' AND schemaname = 'public';

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
This migration completes Phase 2.5 of the RLS Policy Fix Plan for class_sessions:

POLICIES CREATED:
1. "Teachers can manage class sessions" - Teachers can manage sessions for their classes
2. "Anonymous users can view non-expired sessions" - Students can view sessions that haven't expired
3. "Authenticated users can view non-expired sessions" - Teachers can view sessions that haven't expired
4. "Service role full access to class_sessions" - Admin operations via service role

KEY FEATURES:
- Uses EXISTS subqueries to check class ownership for teachers
- Simple policies that check direct column values and single-level subqueries
- Service role access for admin operations
- Anonymous access for student visual password authentication
- Only allows viewing sessions that haven't expired for security

TABLE STRUCTURE:
- class_sessions table has: id, class_id, student_id, session_token, expires_at, created_at, last_activity_at
- No is_active column - uses expires_at > now() to determine if session is still valid

SECURITY MODEL:
- Teachers can only manage sessions for classes they own
- Students (anonymous) can only view sessions that haven't expired
- Admin operations handled via service role in application layer
- No complex joins that could cause recursion
- Non-expired sessions are viewable by everyone (appropriate for classroom access)
*/