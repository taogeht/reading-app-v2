-- BetterAuth Database Tables
-- Creates the required tables for BetterAuth alongside existing profiles table
-- Migration Date: 2025-07-15

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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
    UNIQUE(provider, account_id)
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

-- Add visual_password_id to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS visual_password_id TEXT,
ADD CONSTRAINT profiles_visual_password_id_fkey 
FOREIGN KEY (visual_password_id) REFERENCES visual_passwords(id) ON DELETE SET NULL;

-- Add class access tokens to classes table
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS allow_student_access BOOLEAN DEFAULT TRUE;

-- Generate access tokens for existing classes (if any)
UPDATE classes 
SET access_token = UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8))
WHERE access_token IS NULL;

-- Create indexes for BetterAuth tables
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

-- Create function to sync profile updates back to BetterAuth user
CREATE OR REPLACE FUNCTION sync_profile_to_user()
RETURNS TRIGGER AS $$
BEGIN
    -- When profile is updated, sync back to BetterAuth user table
    IF TG_OP = 'UPDATE' THEN
        UPDATE "user" 
        SET 
            email = NEW.email,
            name = NEW.full_name,
            updated_at = NEW.updated_at
        WHERE email = OLD.email;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync profile changes back to BetterAuth
DROP TRIGGER IF EXISTS sync_profile_to_user_trigger ON profiles;
CREATE TRIGGER sync_profile_to_user_trigger
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_profile_to_user();

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

COMMENT ON TABLE "user" IS 'BetterAuth users table';
COMMENT ON TABLE session IS 'BetterAuth sessions for user authentication';
COMMENT ON TABLE account IS 'BetterAuth accounts for different authentication providers';
COMMENT ON TABLE verification IS 'BetterAuth verifications for email verification and password reset';
COMMENT ON TABLE visual_passwords IS 'Visual password options for student authentication';
COMMENT ON FUNCTION sync_user_to_profile() IS 'Automatically sync BetterAuth users to profiles table';
COMMENT ON FUNCTION sync_profile_to_user() IS 'Automatically sync profile updates back to BetterAuth users';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Remove expired authentication sessions';
COMMENT ON FUNCTION cleanup_expired_verifications() IS 'Remove expired verification tokens';