-- Updated teacher creation function to avoid UUID conflicts

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
    max_attempts INT := 5;
    attempt_count INT := 0;
BEGIN
    -- Check if username already exists
    IF EXISTS (SELECT 1 FROM profiles WHERE username = p_username) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Username already exists'
        );
    END IF;
    
    -- Generate password if not provided
    IF p_auto_password IS NULL THEN
        generated_password := generate_random_password(12);
    ELSE
        generated_password := p_auto_password;
    END IF;
    
    -- Create a fake email for Supabase auth
    fake_email := p_username || '@teacherlogin.internal';
    
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = fake_email) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User already exists with this username'
        );
    END IF;
    
    -- Generate a unique UUID
    LOOP
        auth_user_id := gen_random_uuid();
        attempt_count := attempt_count + 1;
        
        -- Check if this UUID is already used
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth_user_id) THEN
            EXIT; -- UUID is unique, exit loop
        END IF;
        
        -- Prevent infinite loop
        IF attempt_count >= max_attempts THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Could not generate unique user ID'
            );
        END IF;
    END LOOP;
    
    -- Create auth user with the unique UUID
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        is_super_admin,
        role,
        aud,
        created_at,
        updated_at
    ) VALUES (
        auth_user_id,
        fake_email,
        crypt(generated_password, gen_salt('bf')),
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
    );
    
    -- Create profile record with the same UUID
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
    
    -- Return success result
    result := json_build_object(
        'success', true,
        'user_id', auth_user_id,
        'username', p_username,
        'password', generated_password,
        'email', fake_email
    );
    
    RETURN result;
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Username or email already exists'
        );
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to create user: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;