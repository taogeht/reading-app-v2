-- Create recording_submissions table for student audio uploads

CREATE TABLE IF NOT EXISTS recording_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    story_id VARCHAR(255) NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    duration INTEGER NOT NULL, -- Duration in seconds
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recording_submissions_student_id ON recording_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_recording_submissions_class_id ON recording_submissions(class_id);
CREATE INDEX IF NOT EXISTS idx_recording_submissions_story_id ON recording_submissions(story_id);
CREATE INDEX IF NOT EXISTS idx_recording_submissions_status ON recording_submissions(status);
CREATE INDEX IF NOT EXISTS idx_recording_submissions_submitted_at ON recording_submissions(submitted_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recording_submissions_updated_at 
    BEFORE UPDATE ON recording_submissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE recording_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Students can only see their own recordings
CREATE POLICY "Students can view their own recordings" 
ON recording_submissions FOR SELECT 
USING (
    auth.uid() IN (
        SELECT id FROM profiles 
        WHERE id = recording_submissions.student_id 
        AND role = 'student'
    )
);

-- Policy: Students can insert their own recordings
CREATE POLICY "Students can insert their own recordings" 
ON recording_submissions FOR INSERT 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM profiles 
        WHERE id = recording_submissions.student_id 
        AND role = 'student'
    )
);

-- Policy: Teachers can view recordings from their classes
CREATE POLICY "Teachers can view class recordings" 
ON recording_submissions FOR SELECT 
USING (
    auth.uid() IN (
        SELECT teacher_id FROM classes 
        WHERE id = recording_submissions.class_id
    )
    OR
    auth.uid() IN (
        SELECT id FROM profiles 
        WHERE role = 'admin'
    )
);

-- Policy: Teachers can update recordings from their classes
CREATE POLICY "Teachers can update class recordings" 
ON recording_submissions FOR UPDATE 
USING (
    auth.uid() IN (
        SELECT teacher_id FROM classes 
        WHERE id = recording_submissions.class_id
    )
    OR
    auth.uid() IN (
        SELECT id FROM profiles 
        WHERE role = 'admin'
    )
);

-- Policy: Admins have full access
CREATE POLICY "Admins have full access to recordings" 
ON recording_submissions FOR ALL 
USING (
    auth.uid() IN (
        SELECT id FROM profiles 
        WHERE role = 'admin'
    )
);

COMMENT ON TABLE recording_submissions IS 'Stores student audio recording submissions for teacher review';
COMMENT ON COLUMN recording_submissions.file_path IS 'Path to audio file in Supabase storage';
COMMENT ON COLUMN recording_submissions.duration IS 'Recording duration in seconds';
COMMENT ON COLUMN recording_submissions.metadata IS 'Additional metadata like file size, content type, etc.';