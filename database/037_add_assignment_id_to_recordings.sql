-- Add assignment_id column to recording_submissions table to link recordings to assignments
-- Migration: 037_add_assignment_id_to_recordings.sql

-- Add assignment_id column (nullable since existing recordings don't have assignments)
ALTER TABLE recording_submissions 
ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES assignments(id);

-- Add index for better query performance when filtering by assignment
CREATE INDEX IF NOT EXISTS idx_recording_submissions_assignment_id 
ON recording_submissions(assignment_id);

-- Add composite index for class_id and assignment_id for efficient teacher queries
CREATE INDEX IF NOT EXISTS idx_recording_submissions_class_assignment 
ON recording_submissions(class_id, assignment_id);

-- Add composite index for student_id and assignment_id for student assignment history
CREATE INDEX IF NOT EXISTS idx_recording_submissions_student_assignment 
ON recording_submissions(student_id, assignment_id);

-- Comment for documentation
COMMENT ON COLUMN recording_submissions.assignment_id IS 'Links recording to a specific assignment (NULL for free practice recordings)';