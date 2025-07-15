-- Reading Practice Platform Database Schema
-- Run this in Supabase SQL Editor to create the database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- =============================================================================
-- PROFILES TABLE
-- =============================================================================
-- Note: Supabase automatically creates auth.users table
-- This profiles table extends the auth with application-specific data

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')) DEFAULT 'student',
    class_id UUID, -- Will add foreign key constraint later
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- CLASSES TABLE 
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    grade_level INTEGER NOT NULL CHECK (grade_level >= 1 AND grade_level <= 12),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    school_year TEXT, -- e.g., "2024-2025"
    description TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- ASSIGNMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    story_id TEXT NOT NULL, -- References story from stories.json
    story_title TEXT NOT NULL, -- Cache story title for easy display
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    due_date TIMESTAMPTZ,
    instructions TEXT,
    max_attempts INTEGER DEFAULT 3,
    is_published BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- RECORDINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    
    -- Audio file information
    audio_url TEXT NOT NULL, -- Supabase Storage URL
    audio_filename TEXT NOT NULL,
    audio_size_bytes BIGINT,
    audio_duration_seconds DECIMAL(10,2),
    
    -- Analysis results (populated by background job)
    transcript TEXT,
    feedback_data JSONB, -- Stores the complete FeedbackData object
    accuracy_score DECIMAL(5,2) CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
    reading_pace TEXT CHECK (reading_pace IN ('too-fast', 'just-right', 'too-slow')),
    word_count INTEGER,
    correct_words INTEGER,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Metadata
    submitted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Ensure one recording per assignment per attempt for each student
    UNIQUE(student_id, assignment_id, attempt_number)
);

-- =============================================================================
-- ADD FOREIGN KEY CONSTRAINTS (AFTER ALL TABLES EXIST)
-- =============================================================================

-- Add the class_id foreign key to profiles now that classes table exists (if it doesn't already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_class_id_fkey'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_class_id_fkey 
        FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_class_id_idx ON public.profiles(class_id);

-- Classes indexes  
CREATE INDEX IF NOT EXISTS classes_teacher_id_idx ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS classes_grade_level_idx ON public.classes(grade_level);
CREATE INDEX IF NOT EXISTS classes_active_idx ON public.classes(is_active) WHERE is_active = true;

-- Assignments indexes
CREATE INDEX IF NOT EXISTS assignments_class_id_idx ON public.assignments(class_id);
CREATE INDEX IF NOT EXISTS assignments_teacher_id_idx ON public.assignments(teacher_id);
CREATE INDEX IF NOT EXISTS assignments_story_id_idx ON public.assignments(story_id);
CREATE INDEX IF NOT EXISTS assignments_due_date_idx ON public.assignments(due_date);
CREATE INDEX IF NOT EXISTS assignments_published_idx ON public.assignments(is_published) WHERE is_published = true;

-- Recordings indexes
CREATE INDEX IF NOT EXISTS recordings_student_id_idx ON public.recordings(student_id);
CREATE INDEX IF NOT EXISTS recordings_assignment_id_idx ON public.recordings(assignment_id);
CREATE INDEX IF NOT EXISTS recordings_status_idx ON public.recordings(status);
CREATE INDEX IF NOT EXISTS recordings_submitted_at_idx ON public.recordings(submitted_at);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Teachers can view students in their classes" ON public.profiles
    FOR SELECT USING (
        role = 'student' AND 
        class_id IN (
            SELECT id FROM public.classes WHERE teacher_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Classes policies
CREATE POLICY "Teachers can manage their own classes" ON public.classes
    FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Students can view their assigned class" ON public.classes
    FOR SELECT USING (
        id IN (
            SELECT class_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all classes" ON public.classes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Assignments policies
CREATE POLICY "Teachers can manage assignments for their classes" ON public.assignments
    FOR ALL USING (
        teacher_id = auth.uid() OR 
        class_id IN (
            SELECT id FROM public.classes WHERE teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can view assignments for their class" ON public.assignments
    FOR SELECT USING (
        is_published = true AND
        class_id IN (
            SELECT class_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all assignments" ON public.assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Recordings policies
CREATE POLICY "Students can manage their own recordings" ON public.recordings
    FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers can view recordings from their class assignments" ON public.recordings
    FOR SELECT USING (
        assignment_id IN (
            SELECT a.id FROM public.assignments a
            JOIN public.classes c ON a.class_id = c.id
            WHERE c.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all recordings" ON public.recordings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- TRIGGER FUNCTIONS FOR AUTOMATIC TIMESTAMPS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers (conditional)
DROP TRIGGER IF EXISTS handle_profiles_updated_at ON public.profiles;
CREATE TRIGGER handle_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_classes_updated_at ON public.classes;
CREATE TRIGGER handle_classes_updated_at
    BEFORE UPDATE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_assignments_updated_at ON public.assignments;
CREATE TRIGGER handle_assignments_updated_at
    BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_recordings_updated_at ON public.recordings;
CREATE TRIGGER handle_recordings_updated_at
    BEFORE UPDATE ON public.recordings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- AUTOMATIC PROFILE CREATION
-- =============================================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'role', 'student'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on signup (conditional)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- STORAGE BUCKET FOR AUDIO FILES
-- =============================================================================

-- Create storage bucket for recordings (conditional - only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio files
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Students can upload their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view recordings from their students" ON storage.objects;

-- Create storage policies
CREATE POLICY "Students can upload their own recordings" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'recordings' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Students can view their own recordings" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'recordings' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Teachers can view recordings from their students" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'recordings' AND
        (storage.foldername(name))[1] IN (
            SELECT p.id::text FROM public.profiles p
            JOIN public.classes c ON p.class_id = c.id
            WHERE c.teacher_id = auth.uid() AND p.role = 'student'
        )
    );

CREATE POLICY "Admins can manage all recordings" ON storage.objects
    FOR ALL USING (
        bucket_id = 'recordings' AND
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =============================================================================

-- Insert sample admin user (replace with actual admin email)
-- INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
-- VALUES (uuid_generate_v4(), 'admin@school.edu', now(), now(), now());

-- The trigger will automatically create the profile