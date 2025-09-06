-- Railway Complete Database Setup
-- Run this entire script in Railway's PostgreSQL Query console
-- This will create all necessary tables for your reading app

-- =====================================
-- PART 1: Core Schema (from 001_initial_schema.sql)
-- =====================================

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

-- =====================================
-- PART 2: BetterAuth Tables (from 002_betterauth_tables.sql)
-- =====================================

-- Create BetterAuth user table
CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    image TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create BetterAuth session table
CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create BetterAuth account table (for different auth providers)
CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMP WITH TIME ZONE,
    refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
    scope TEXT,
    password TEXT, -- For email/password authentication
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create BetterAuth verification table (for email verification, password reset)
CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create visual passwords table for student authentication
CREATE TABLE IF NOT EXISTS visual_passwords (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    display_emoji TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('animals', 'shapes', 'colors', 'objects')),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- PART 3: Add Foreign Key Constraints
-- =====================================

-- Add foreign key constraints for core tables
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

-- Add foreign key constraints for BetterAuth tables
ALTER TABLE session
ADD CONSTRAINT session_user_id_fkey
FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

ALTER TABLE account
ADD CONSTRAINT account_user_id_fkey
FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

-- Add visual password relationship to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS visual_password_id TEXT;

ALTER TABLE profiles
ADD CONSTRAINT profiles_visual_password_id_fkey 
FOREIGN KEY (visual_password_id) REFERENCES visual_passwords(id) ON DELETE SET NULL;

-- Add class access tokens
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS allow_student_access BOOLEAN DEFAULT TRUE;

-- Add unique constraints for BetterAuth
ALTER TABLE account ADD CONSTRAINT account_provider_account_id_unique UNIQUE(provider, account_id);

-- =====================================
-- PART 4: Create Indexes for Performance
-- =====================================

-- Indexes for core tables
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

-- Indexes for BetterAuth tables
CREATE INDEX IF NOT EXISTS user_email_idx ON "user"(email);
CREATE INDEX IF NOT EXISTS session_user_id_idx ON session(user_id);
CREATE INDEX IF NOT EXISTS session_token_idx ON session(token);
CREATE INDEX IF NOT EXISTS session_expires_at_idx ON session(expires_at);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON account(user_id);
CREATE INDEX IF NOT EXISTS account_provider_idx ON account(provider, account_id);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);
CREATE INDEX IF NOT EXISTS verification_expires_at_idx ON verification(expires_at);
CREATE INDEX IF NOT EXISTS visual_passwords_category_idx ON visual_passwords(category);
CREATE INDEX IF NOT EXISTS visual_passwords_sort_order_idx ON visual_passwords(sort_order);
CREATE INDEX IF NOT EXISTS profiles_visual_password_id_idx ON profiles(visual_password_id);
CREATE INDEX IF NOT EXISTS classes_access_token_idx ON classes(access_token);

-- =====================================
-- PART 5: Create Functions and Triggers
-- =====================================

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

-- Create function to sync BetterAuth user with profiles table
CREATE OR REPLACE FUNCTION sync_user_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new user is created in BetterAuth, create corresponding profile
    IF TG_OP = 'INSERT' THEN
        INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            NEW.email,
            NEW.name,
            'student', -- Default role, can be updated
            NEW.created_at,
            NEW.updated_at
        )
        ON CONFLICT (email) DO NOTHING; -- Don't overwrite existing profiles
        
        RETURN NEW;
    END IF;
    
    -- When user is updated, sync to profile
    IF TG_OP = 'UPDATE' THEN
        UPDATE profiles 
        SET 
            email = NEW.email,
            full_name = NEW.name,
            updated_at = NEW.updated_at
        WHERE email = OLD.email;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically sync BetterAuth users to profiles
DROP TRIGGER IF EXISTS sync_user_to_profile_trigger ON "user";
CREATE TRIGGER sync_user_to_profile_trigger
    AFTER INSERT OR UPDATE ON "user"
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_to_profile();

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM session WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired verifications
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM verification WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- PART 6: Insert Initial Data
-- =====================================

-- Insert default visual passwords
INSERT INTO visual_passwords (name, display_emoji, category, sort_order) VALUES
('Cat', '🐱', 'animals', 1),
('Dog', '🐶', 'animals', 2),
('Lion', '🦁', 'animals', 3),
('Elephant', '🐘', 'animals', 4),
('Rabbit', '🐰', 'animals', 5),
('Bear', '🐻', 'animals', 6),
('Star', '⭐', 'shapes', 7),
('Heart', '❤️', 'shapes', 8),
('Circle', '⭕', 'shapes', 9),
('Square', '◻️', 'shapes', 10),
('Triangle', '🔺', 'shapes', 11),
('Diamond', '💎', 'shapes', 12),
('Apple', '🍎', 'objects', 13),
('Ball', '⚽', 'objects', 14),
('Book', '📚', 'objects', 15),
('Car', '🚗', 'objects', 16),
('House', '🏠', 'objects', 17),
('Flower', '🌸', 'objects', 18)
ON CONFLICT DO NOTHING;

-- Generate access tokens for any existing classes
UPDATE classes 
SET access_token = UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8))
WHERE access_token IS NULL;

-- Insert initial admin user
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

-- =====================================
-- SETUP COMPLETE!
-- =====================================

-- Verify tables were created
SELECT 'Setup Complete! Tables created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;