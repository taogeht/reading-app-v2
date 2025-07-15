-- Add username field to profiles table and update user creation workflow

-- Add username column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Create a function to generate a random password
CREATE OR REPLACE FUNCTION generate_random_password(length INT DEFAULT 12)
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    result TEXT := '';
    i INT;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to create teacher with username and auto-confirmation
CREATE OR REPLACE FUNCTION create_teacher_with_username(
    p_username VARCHAR(50),
    p_full_name TEXT,
    p_auto_password TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    generated_password TEXT;
    fake_email TEXT;
    auth_user_id UUID;
    result JSON;
BEGIN
    -- Generate password if not provided
    IF p_auto_password IS NULL THEN
        generated_password := generate_random_password(12);
    ELSE
        generated_password := p_auto_password;
    END IF;
    
    -- Create a fake email for Supabase auth (since it requires email)
    fake_email := p_username || '@teacherlogin.internal';
    
    -- Create auth user with auto-confirmation
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmed_at,
        raw_user_meta_data,
        is_super_admin,
        role,
        aud,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        fake_email,
        crypt(generated_password, gen_salt('bf')),
        NOW(),
        NOW(),
        jsonb_build_object(
            'username', p_username,
            'full_name', p_full_name,
            'role', 'teacher'
        ),
        false,
        'authenticated',
        'authenticated',
        NOW(),
        NOW()
    ) RETURNING id INTO auth_user_id;
    
    -- Create profile record
    INSERT INTO profiles (
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        auth_user_id,
        p_username,
        fake_email,
        p_full_name,
        'teacher',
        true,
        NOW(),
        NOW()
    );
    
    -- Return the results
    result := json_build_object(
        'user_id', auth_user_id,
        'username', p_username,
        'password', generated_password,
        'email', fake_email
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for username-based authentication
CREATE OR REPLACE FUNCTION authenticate_with_username(
    p_username VARCHAR(50),
    p_password TEXT
)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    auth_user auth.users%ROWTYPE;
    result JSON;
BEGIN
    -- Find user by username
    SELECT p.*, au.encrypted_password, au.email
    INTO user_record
    FROM profiles p
    JOIN auth.users au ON p.id = au.id
    WHERE p.username = p_username AND p.is_active = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invalid username or password');
    END IF;
    
    -- Verify password
    IF user_record.encrypted_password = crypt(p_password, user_record.encrypted_password) THEN
        -- Password is correct
        result := json_build_object(
            'success', true,
            'user_id', user_record.id,
            'username', user_record.username,
            'email', user_record.email,
            'full_name', user_record.full_name,
            'role', user_record.role,
            'class_id', user_record.class_id
        );
        
        -- Update last login time
        UPDATE profiles SET updated_at = NOW() WHERE id = user_record.id;
        
        RETURN result;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid username or password');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON COLUMN profiles.username IS 'Unique username for login (replaces email for teachers)';
COMMENT ON FUNCTION create_teacher_with_username IS 'Creates a teacher account with username, auto-generates password, and auto-confirms the account';
COMMENT ON FUNCTION authenticate_with_username IS 'Authenticates user with username instead of email';