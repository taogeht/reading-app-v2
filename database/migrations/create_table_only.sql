-- Create recording_submissions table only (no storage policies)

CREATE TABLE IF NOT EXISTS recording_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    story_id VARCHAR(255) NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    duration INTEGER NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recording_submissions_student_id ON recording_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_recording_submissions_class_id ON recording_submissions(class_id);
CREATE INDEX IF NOT EXISTS idx_recording_submissions_story_id ON recording_submissions(story_id);
CREATE INDEX IF NOT EXISTS idx_recording_submissions_status ON recording_submissions(status);
CREATE INDEX IF NOT EXISTS idx_recording_submissions_submitted_at ON recording_submissions(submitted_at DESC);

-- Enable RLS
ALTER TABLE recording_submissions ENABLE ROW LEVEL SECURITY;

-- Basic policies for recording_submissions table
CREATE POLICY "Users can view own recordings" ON recording_submissions
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert recordings" ON recording_submissions
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers and admins full access" ON recording_submissions
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM profiles 
            WHERE role IN ('teacher', 'admin')
        )
    );