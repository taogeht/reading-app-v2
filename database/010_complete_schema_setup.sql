-- Complete Database Schema Setup for Reading Practice Platform
-- Run this AFTER the emergency fix to ensure all tables and fields exist

-- =============================================================================
-- ENABLE EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- UPDATE PROFILES TABLE (ADD MISSING FIELDS)
-- =============================================================================

-- Add missing columns to profiles table if they don't exist
DO $$
BEGIN
    -- Add visual_password_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'visual_password_id') THEN
        ALTER TABLE public.profiles ADD COLUMN visual_password_id TEXT;
    END IF;
    
    -- Add is_active column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
        ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
    END IF;
    
    -- Add last_accessed_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_accessed_at') THEN
        ALTER TABLE public.profiles ADD COLUMN last_accessed_at TIMESTAMPTZ;
    END IF;
END $$;

-- =============================================================================
-- UPDATE CLASSES TABLE (ADD MISSING FIELDS)
-- =============================================================================

-- Add missing columns to classes table if they don't exist
DO $$
BEGIN
    -- Add max_students column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'max_students') THEN
        ALTER TABLE public.classes ADD COLUMN max_students INTEGER DEFAULT 25 CHECK (max_students > 0);
    END IF;
    
    -- Add access_token column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'access_token') THEN
        ALTER TABLE public.classes ADD COLUMN access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');
    END IF;
END $$;

-- =============================================================================
-- CREATE ASSIGNMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    story_id TEXT NOT NULL,
    story_title TEXT NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    due_date TIMESTAMPTZ,
    instructions TEXT,
    max_attempts INTEGER DEFAULT 3 CHECK (max_attempts > 0),
    is_published BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- CREATE RECORDINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
    attempt_number INTEGER DEFAULT 1 NOT NULL,
    audio_url TEXT NOT NULL,
    audio_filename TEXT NOT NULL,
    audio_size_bytes BIGINT,
    audio_duration_seconds NUMERIC,
    transcript TEXT,
    feedback_data JSONB,
    accuracy_score NUMERIC CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
    reading_pace TEXT CHECK (reading_pace IN ('too-fast', 'just-right', 'too-slow')),
    word_count INTEGER,
    correct_words INTEGER,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(student_id, assignment_id, attempt_number)
);

-- =============================================================================
-- CREATE VISUAL PASSWORDS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.visual_passwords (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('animals', 'shapes', 'objects', 'colors')),
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- CREATE CLASS SESSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.class_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    student_name TEXT NOT NULL,
    visual_password_id TEXT REFERENCES public.visual_passwords(id),
    session_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '8 hours') NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- ADD MISSING FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Add class_id foreign key to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_class_id_fkey'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_class_id_fkey 
        FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add visual_password_id foreign key to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_visual_password_fkey'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_visual_password_fkey 
        FOREIGN KEY (visual_password_id) REFERENCES public.visual_passwords(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================================================
-- INSERT SAMPLE VISUAL PASSWORDS
-- =============================================================================

INSERT INTO public.visual_passwords (id, category, name, image_url) VALUES
    ('cat', 'animals', 'Cat', '🐱'),
    ('dog', 'animals', 'Dog', '🐶'),
    ('elephant', 'animals', 'Elephant', '🐘'),
    ('lion', 'animals', 'Lion', '🦁'),
    ('butterfly', 'animals', 'Butterfly', '🦋'),
    ('fish', 'animals', 'Fish', '🐠'),
    ('star', 'shapes', 'Star', '⭐'),
    ('heart', 'shapes', 'Heart', '💖'),
    ('circle', 'shapes', 'Circle', '🔵'),
    ('triangle', 'shapes', 'Triangle', '🔺'),
    ('square', 'shapes', 'Square', '🟦'),
    ('diamond', 'shapes', 'Diamond', '💎'),
    ('sun', 'objects', 'Sun', '☀️'),
    ('flower', 'objects', 'Flower', '🌸'),
    ('book', 'objects', 'Book', '📚'),
    ('car', 'objects', 'Car', '🚗'),
    ('house', 'objects', 'House', '🏠'),
    ('tree', 'objects', 'Tree', '🌳'),
    ('red', 'colors', 'Red', '🔴'),
    ('blue', 'colors', 'Blue', '🔵'),
    ('green', 'colors', 'Green', '🟢'),
    ('yellow', 'colors', 'Yellow', '🟡'),
    ('purple', 'colors', 'Purple', '🟣'),
    ('orange', 'colors', 'Orange', '🟠')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_class_id ON public.profiles(class_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);

-- Classes indexes
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_active ON public.classes(is_active);
CREATE INDEX IF NOT EXISTS idx_classes_grade_level ON public.classes(grade_level);
CREATE INDEX IF NOT EXISTS idx_classes_access_token ON public.classes(access_token);

-- Assignments indexes
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON public.assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON public.assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_published ON public.assignments(is_published);

-- Recordings indexes
CREATE INDEX IF NOT EXISTS idx_recordings_student_id ON public.recordings(student_id);
CREATE INDEX IF NOT EXISTS idx_recordings_assignment_id ON public.recordings(assignment_id);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON public.recordings(status);
CREATE INDEX IF NOT EXISTS idx_recordings_submitted ON public.recordings(submitted_at);

-- Class sessions indexes
CREATE INDEX IF NOT EXISTS idx_class_sessions_class_id ON public.class_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_expires ON public.class_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_class_sessions_token ON public.class_sessions(session_token);

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- CREATE OR UPDATE TRIGGERS
-- =============================================================================

-- Updated trigger function for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update triggers for all tables
DROP TRIGGER IF EXISTS handle_updated_at_profiles ON public.profiles;
CREATE TRIGGER handle_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_classes ON public.classes;
CREATE TRIGGER handle_updated_at_classes
    BEFORE UPDATE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_assignments ON public.assignments;
CREATE TRIGGER handle_updated_at_assignments
    BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_recordings ON public.recordings;
CREATE TRIGGER handle_updated_at_recordings
    BEFORE UPDATE ON public.recordings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- GENERATE ACCESS TOKENS FOR EXISTING CLASSES
-- =============================================================================

-- Update existing classes that don't have access tokens
UPDATE public.classes 
SET access_token = encode(gen_random_bytes(16), 'hex')
WHERE access_token IS NULL;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check that all tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('profiles', 'classes', 'assignments', 'recordings', 'visual_passwords', 'class_sessions')
ORDER BY table_name;

-- Check that all required columns exist
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN ('profiles', 'classes')
    AND column_name IN ('visual_password_id', 'is_active', 'last_accessed_at', 'max_students', 'access_token')
ORDER BY table_name, column_name;