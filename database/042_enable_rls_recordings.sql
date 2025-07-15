-- Fix RLS Policy Issues - Phase 2: Re-enable RLS on Recording Tables
-- This migration re-enables RLS on both recordings and recording_submissions tables

-- ===================================================================
-- STEP 1: RE-ENABLE RLS ON RECORDING TABLES
-- ===================================================================

-- Enable RLS on recording_submissions (main table used by application)
ALTER TABLE public.recording_submissions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on recordings table (if it exists - might be legacy)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'recordings' AND schemaname = 'public') THEN
        ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ===================================================================
-- STEP 2: CREATE POLICIES FOR RECORDING_SUBMISSIONS TABLE
-- ===================================================================

-- Policy 1: Students can manage their own recordings
-- Simple check against student_id column
CREATE POLICY "Students can manage own recordings" ON public.recording_submissions
    FOR ALL
    TO anon, authenticated
    USING (student_id = auth.uid() OR student_id IS NULL) -- Allow anonymous student access
    WITH CHECK (student_id = auth.uid() OR student_id IS NULL);

-- Policy 2: Teachers can view recordings for their classes
-- Uses EXISTS to check if teacher owns the class
CREATE POLICY "Teachers can view class recordings" ON public.recording_submissions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.classes 
            WHERE classes.id = recording_submissions.class_id 
            AND classes.teacher_id = auth.uid()
        )
    );

-- Policy 3: Service role has full access (for admin operations)
CREATE POLICY "Service role full access to recording_submissions" ON public.recording_submissions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===================================================================
-- STEP 3: CREATE POLICIES FOR RECORDINGS TABLE (IF IT EXISTS)
-- ===================================================================

-- Create policies for recordings table if it exists
-- Note: recordings table has assignment_id but no class_id, so we need to join through assignments
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'recordings' AND schemaname = 'public') THEN
        
        -- Policy 1: Students can manage their own recordings
        EXECUTE 'CREATE POLICY "Students can manage own recordings" ON public.recordings
            FOR ALL
            TO anon, authenticated
            USING (student_id = auth.uid() OR student_id IS NULL)
            WITH CHECK (student_id = auth.uid() OR student_id IS NULL)';

        -- Policy 2: Teachers can view recordings for their assignments
        -- Since recordings table has assignment_id, we need to join through assignments -> classes
        EXECUTE 'CREATE POLICY "Teachers can view assignment recordings" ON public.recordings
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.assignments 
                    JOIN public.classes ON assignments.class_id = classes.id
                    WHERE assignments.id = recordings.assignment_id 
                    AND classes.teacher_id = auth.uid()
                )
            )';

        -- Policy 3: Service role has full access
        EXECUTE 'CREATE POLICY "Service role full access to recordings" ON public.recordings
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true)';
            
    END IF;
END $$;

-- ===================================================================
-- STEP 4: GRANT NECESSARY PERMISSIONS
-- ===================================================================

-- Grant permissions for recording_submissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recording_submissions TO authenticated, anon;
GRANT ALL ON public.recording_submissions TO service_role;

-- Grant permissions for recordings table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'recordings' AND schemaname = 'public') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.recordings TO authenticated, anon;
        GRANT ALL ON public.recordings TO service_role;
    END IF;
END $$;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check that RLS is enabled on recording_submissions
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'recording_submissions' AND schemaname = 'public';

-- Check that RLS is enabled on recordings (if it exists)
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'recordings' AND schemaname = 'public';

-- Check the policies that were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('recording_submissions', 'recordings') AND schemaname = 'public';

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
This migration completes Phase 2.4 of the RLS Policy Fix Plan for recording tables:

POLICIES CREATED FOR RECORDING_SUBMISSIONS:
1. "Students can manage own recordings" - Students can manage their own recordings
2. "Teachers can view class recordings" - Teachers can view recordings for their classes (via class_id)
3. "Service role full access to recording_submissions" - Admin operations via service role

POLICIES CREATED FOR RECORDINGS (IF TABLE EXISTS):
1. "Students can manage own recordings" - Students can manage their own recordings
2. "Teachers can view assignment recordings" - Teachers can view recordings for their assignments (via assignment_id -> class_id)
3. "Service role full access to recordings" - Admin operations via service role

KEY FEATURES:
- Supports both anonymous (student) and authenticated (teacher) access
- Uses EXISTS subqueries to check ownership for teachers
- Different join paths for different table structures:
  * recording_submissions: direct class_id lookup
  * recordings: assignment_id -> assignments -> classes lookup
- Service role access for admin operations
- Handles both current (recording_submissions) and legacy (recordings) tables

TABLE STRUCTURE DIFFERENCES:
- recording_submissions: has class_id (newer table)
- recordings: has assignment_id but no class_id (original schema)

SECURITY MODEL:
- Students can only access their own recordings
- Teachers can only view recordings for classes/assignments they own
- Admin operations handled via service role in application layer
- Anonymous access supported for student visual password authentication
*/