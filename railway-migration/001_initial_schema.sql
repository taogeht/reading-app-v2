-- Railway Migration Schema
-- Migrated from Supabase to Railway PostgreSQL
-- Migration Date: 2025-07-15

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create profiles table (users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    class_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    grade_level INTEGER NOT NULL,
    teacher_id UUID NOT NULL,
    school_year TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    story_id TEXT NOT NULL,
    story_title TEXT NOT NULL,
    class_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    instructions TEXT,
    max_attempts INTEGER DEFAULT 3,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create recordings table
CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    assignment_id UUID NOT NULL,
    attempt_number INTEGER DEFAULT 1,
    audio_url TEXT NOT NULL,
    audio_filename TEXT NOT NULL,
    audio_size_bytes BIGINT,
    audio_duration_seconds NUMERIC,
    transcript TEXT,
    feedback_data JSONB,
    accuracy_score NUMERIC,
    reading_pace TEXT CHECK (reading_pace IN ('too-fast', 'just-right', 'too-slow')),
    word_count INTEGER,
    correct_words INTEGER,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE profiles 
ADD CONSTRAINT profiles_class_id_fkey 
FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

ALTER TABLE classes 
ADD CONSTRAINT classes_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE assignments 
ADD CONSTRAINT assignments_class_id_fkey 
FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

ALTER TABLE assignments 
ADD CONSTRAINT assignments_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE recordings 
ADD CONSTRAINT recordings_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE recordings 
ADD CONSTRAINT recordings_assignment_id_fkey 
FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
CREATE INDEX IF NOT EXISTS profiles_class_id_idx ON profiles(class_id);

CREATE INDEX IF NOT EXISTS classes_teacher_id_idx ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS classes_is_active_idx ON classes(is_active);

CREATE INDEX IF NOT EXISTS assignments_class_id_idx ON assignments(class_id);
CREATE INDEX IF NOT EXISTS assignments_teacher_id_idx ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS assignments_is_published_idx ON assignments(is_published);

CREATE INDEX IF NOT EXISTS recordings_student_id_idx ON recordings(student_id);
CREATE INDEX IF NOT EXISTS recordings_assignment_id_idx ON recordings(assignment_id);
CREATE INDEX IF NOT EXISTS recordings_status_idx ON recordings(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all tables
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at 
    BEFORE UPDATE ON classes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at 
    BEFORE UPDATE ON assignments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordings_updated_at 
    BEFORE UPDATE ON recordings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial admin user (update credentials as needed)
INSERT INTO profiles (id, email, username, full_name, role, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'admin@readingapp.com',
    'admin',
    'System Administrator',
    'admin',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE profiles IS 'User profiles including students, teachers, and administrators';
COMMENT ON TABLE classes IS 'School classes managed by teachers';
COMMENT ON TABLE assignments IS 'Reading assignments created by teachers for classes';
COMMENT ON TABLE recordings IS 'Student audio recordings for assignments with analysis data';