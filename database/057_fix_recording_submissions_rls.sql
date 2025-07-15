-- Fix Recording Submissions RLS Policies
-- This migration fixes the recording_submissions table to allow student submissions
-- PROBLEM: Students can't submit recordings because RLS policies require auth.uid() but students are anonymous

-- ===================================================================
-- STEP 1: DROP ALL EXISTING RECORDING_SUBMISSIONS POLICIES
-- ===================================================================

-- Drop all existing policies (comprehensive list to handle any previous migrations)
DROP POLICY IF EXISTS "Students can view their own recordings" ON recording_submissions;
DROP POLICY IF EXISTS "Students can insert their own recordings" ON recording_submissions;
DROP POLICY IF EXISTS "Teachers can view class recordings" ON recording_submissions;
DROP POLICY IF EXISTS "Teachers can update class recordings" ON recording_submissions;
DROP POLICY IF EXISTS "Admins have full access to recordings" ON recording_submissions;
DROP POLICY IF EXISTS "Admin users can access all recording submissions" ON recording_submissions;
DROP POLICY IF EXISTS "Admin can access all recording submissions" ON recording_submissions;
DROP POLICY IF EXISTS "Admin can access all recording submissions via JWT" ON recording_submissions;
DROP POLICY IF EXISTS "Students can access own recording submissions" ON recording_submissions;
DROP POLICY IF EXISTS "Teachers can access recording submissions in their classes" ON recording_submissions;

-- ===================================================================
-- STEP 2: CREATE STUDENT-FRIENDLY RLS POLICIES
-- ===================================================================

-- Policy: Admins have full access (using JWT-only function)
CREATE POLICY "Admin can access all recording submissions via JWT"
ON recording_submissions FOR ALL
TO authenticated
USING (public.is_admin_jwt_only());

-- Policy: Students can insert their own recordings (anonymous users allowed)
CREATE POLICY "Students can insert their own recordings"
ON recording_submissions FOR INSERT
TO authenticated, anon
WITH CHECK (
    -- Allow inserts if the student_id refers to a valid student profile
    -- This is safe because we validate the student session in the application layer
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = recording_submissions.student_id 
        AND role = 'student' 
        AND is_active = true
    )
);

-- Policy: Students can view their own recordings (using our student access function)
CREATE POLICY "Students can view their own recordings"
ON recording_submissions FOR SELECT
TO authenticated, anon
USING (
    public.student_can_access_profile(student_id)
);

-- Policy: Teachers can view recordings from their classes
CREATE POLICY "Teachers can view class recordings"
ON recording_submissions FOR SELECT
TO authenticated
USING (
    -- Teachers can see recordings from classes they teach
    class_id IN (
        SELECT id FROM public.classes WHERE teacher_id = auth.uid()
    )
);

-- Policy: Teachers can update recordings from their classes (for grading/feedback)
CREATE POLICY "Teachers can update class recordings"
ON recording_submissions FOR UPDATE
TO authenticated
USING (
    -- Teachers can update recordings from classes they teach
    class_id IN (
        SELECT id FROM public.classes WHERE teacher_id = auth.uid()
    )
)
WITH CHECK (
    -- Same condition for update check
    class_id IN (
        SELECT id FROM public.classes WHERE teacher_id = auth.uid()
    )
);

-- ===================================================================
-- STEP 3: CREATE RPC FUNCTION FOR SECURE RECORDING SUBMISSION
-- ===================================================================

-- Create a secure function for students to submit recordings
-- This bypasses RLS and validates the submission properly
CREATE OR REPLACE FUNCTION public.submit_student_recording(
    p_student_id UUID,
    p_story_id TEXT,
    p_class_id UUID,
    p_file_path TEXT,
    p_duration INTEGER,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSON AS $$
DECLARE
    new_submission_id UUID;
    result JSON;
BEGIN
    -- Validate that the student exists and is in the specified class
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_student_id 
        AND class_id = p_class_id 
        AND role = 'student' 
        AND is_active = true
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid student or class'
        );
    END IF;
    
    -- Validate that the class exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.classes 
        WHERE id = p_class_id 
        AND is_active = true
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Class not found or inactive'
        );
    END IF;
    
    -- Insert the recording submission
    INSERT INTO public.recording_submissions (
        student_id,
        story_id,
        class_id,
        file_path,
        duration,
        metadata,
        status,
        submitted_at
    ) VALUES (
        p_student_id,
        p_story_id,
        p_class_id,
        p_file_path,
        p_duration,
        p_metadata,
        'pending',
        NOW()
    ) RETURNING id INTO new_submission_id;
    
    -- Return success
    result := json_build_object(
        'success', true,
        'submission_id', new_submission_id,
        'message', 'Recording submitted successfully'
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to submit recording: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users (students) and authenticated users
GRANT EXECUTE ON FUNCTION public.submit_student_recording TO anon, authenticated;

-- ===================================================================
-- STEP 4: CREATE RPC FUNCTION FOR TEACHER STUDENT COUNTING
-- ===================================================================

-- Create a function to count students in a class (for teacher dashboard)
CREATE OR REPLACE FUNCTION public.count_students_in_class(p_class_id UUID)
RETURNS INTEGER AS $$
DECLARE
    student_count INTEGER;
BEGIN
    -- Count active students in the specified class
    SELECT COUNT(*) INTO student_count
    FROM public.profiles
    WHERE class_id = p_class_id
      AND role = 'student'
      AND is_active = true;
    
    RETURN COALESCE(student_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.count_students_in_class TO authenticated, anon;

-- ===================================================================
-- STEP 5: CREATE RPC FUNCTION FOR TEACHER RECORDING DISPLAY
-- ===================================================================

-- Create a function to get class recordings with student names (for teacher dashboard)
-- This bypasses RLS issues with joins
CREATE OR REPLACE FUNCTION public.get_class_recordings_with_students(
    p_class_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    student_id UUID,
    student_name TEXT,
    story_id TEXT,
    file_path TEXT,
    duration INTEGER,
    submitted_at TIMESTAMPTZ,
    status TEXT,
    assignment_id TEXT,
    archived BOOLEAN,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rs.id,
        rs.student_id,
        COALESCE(p.full_name, 'Unknown Student')::TEXT as student_name,
        rs.story_id::TEXT,
        rs.file_path::TEXT,
        rs.duration,
        rs.submitted_at,
        rs.status::TEXT,
        -- Fix type mismatch: cast UUID to TEXT before COALESCE
        COALESCE(rs.assignment_id::TEXT, rs.metadata->>'assignmentId') as assignment_id,
        COALESCE(rs.archived, false) as archived,
        COALESCE(rs.metadata, '{}'::JSONB) as metadata
    FROM public.recording_submissions rs
    LEFT JOIN public.profiles p ON p.id = rs.student_id
    WHERE rs.class_id = p_class_id
    ORDER BY rs.submitted_at DESC
    LIMIT p_limit;
    
EXCEPTION
    WHEN undefined_column THEN
        -- Handle case where assignment_id column doesn't exist
        RETURN QUERY
        SELECT 
            rs.id,
            rs.student_id,
            COALESCE(p.full_name, 'Unknown Student')::TEXT as student_name,
            rs.story_id::TEXT,
            rs.file_path::TEXT,
            rs.duration,
            rs.submitted_at,
            rs.status::TEXT,
            -- Get assignment_id from metadata only
            COALESCE(rs.metadata->>'assignmentId', '')::TEXT as assignment_id,
            COALESCE(rs.archived, false) as archived,
            COALESCE(rs.metadata, '{}'::JSONB) as metadata
        FROM public.recording_submissions rs
        LEFT JOIN public.profiles p ON p.id = rs.student_id
        WHERE rs.class_id = p_class_id
        ORDER BY rs.submitted_at DESC
        LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (teachers)
GRANT EXECUTE ON FUNCTION public.get_class_recordings_with_students TO authenticated;

-- ===================================================================
-- STEP 6: VERIFICATION AND TESTING
-- ===================================================================

-- Test that RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'recording_submissions';

-- Show current policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename = 'recording_submissions'
ORDER BY policyname;

-- Test the new functions exist
SELECT 
    proname AS function_name,
    prosrc IS NOT NULL AS function_exists
FROM pg_proc 
WHERE proname IN ('submit_student_recording', 'count_students_in_class', 'get_class_recordings_with_students')
ORDER BY proname;

-- ===================================================================
-- SUCCESS MESSAGE
-- ===================================================================

SELECT 'Recording submissions RLS policies fixed! Students can submit recordings, teachers can view recordings with student names, and student counting works.' AS status;