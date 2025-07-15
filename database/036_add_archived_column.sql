-- Add archived column to recording_submissions table
-- Migration: 036_add_archived_column.sql

-- Add archived column with default value false
ALTER TABLE recording_submissions 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add index for better query performance when filtering by archived status
CREATE INDEX IF NOT EXISTS idx_recording_submissions_archived 
ON recording_submissions(archived);

-- Add composite index for class_id and archived for efficient teacher queries
CREATE INDEX IF NOT EXISTS idx_recording_submissions_class_archived 
ON recording_submissions(class_id, archived);

-- Comment for documentation
COMMENT ON COLUMN recording_submissions.archived IS 'Whether the recording has been archived by the teacher';