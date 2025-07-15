-- Storage Setup for Reading Practice Platform
-- Run this to set up file storage for audio recordings

-- =============================================================================
-- STORAGE BUCKET SETUP
-- =============================================================================

-- Create storage bucket for recordings (conditional - only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STORAGE POLICIES
-- =============================================================================

-- Clean up existing policies to avoid conflicts
DROP POLICY IF EXISTS "Students can upload their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view recordings from their students" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all recordings" ON storage.objects;

-- Students can upload recordings to their own folder
-- File path structure: recordings/{student_id}/{filename}
CREATE POLICY "Students can upload their own recordings" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'recordings' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Students can view/download their own recordings
CREATE POLICY "Students can view their own recordings" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'recordings' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Students can delete their own recordings
CREATE POLICY "Students can delete their own recordings" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'recordings' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Teachers can view recordings from students in their classes
CREATE POLICY "Teachers can view recordings from their students" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'recordings' AND
        (storage.foldername(name))[1] IN (
            SELECT p.id::text FROM public.profiles p
            JOIN public.classes c ON p.class_id = c.id
            WHERE c.teacher_id = auth.uid() AND p.role = 'student'
        )
    );

-- Admins can manage all recordings
CREATE POLICY "Admins can manage all recordings" ON storage.objects
    FOR ALL USING (
        bucket_id = 'recordings' AND
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- VERIFY STORAGE SETUP
-- =============================================================================

-- Check if bucket was created
-- SELECT * FROM storage.buckets WHERE id = 'recordings';

-- Check storage policies
-- SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';

-- =============================================================================
-- STORAGE USAGE EXAMPLES
-- =============================================================================

/*
File path structure should be:
recordings/{student_id}/{assignment_id}-{attempt_number}-{timestamp}.webm

Examples:
- recordings/550e8400-e29b-41d4-a716-446655440000/assignment-123-attempt-1-1640995200000.webm
- recordings/550e8400-e29b-41d4-a716-446655440000/assignment-456-attempt-2-1640995300000.wav

This structure allows:
1. Students to only access their own recordings
2. Teachers to access recordings from their students  
3. Easy organization by student and assignment
4. Multiple attempts per assignment tracking
*/