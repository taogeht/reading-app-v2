# Setup Username-Based Authentication

## Quick Setup Instructions

Since the automated script might have issues, here's the manual setup approach:

### 1. Run SQL in Supabase Dashboard

Go to your Supabase project → **SQL Editor** → **New query** and run this SQL:

```sql
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
```

### 2. Create Teacher Creation Function

Run this in a separate SQL query:

```sql
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
```

### 3. Test the Setup

You can test the new teacher creation by running this SQL:

```sql
SELECT create_teacher_with_username('test.teacher', 'Test Teacher');
```

This should return a JSON object with the username and generated password.

### 4. Alternative: Use the Script

If you want to try the automated script:

```bash
npm install dotenv
node setup-username-auth.js
```

### 5. Verify Everything Works

1. Go to your SuperAdmin dashboard
2. Try creating a new teacher with a username
3. You should see the auto-generated credentials
4. Test login with the generated username and password

## Troubleshooting

**If you get permission errors:**
- Make sure you're running the SQL in Supabase Dashboard (not locally)
- Ensure your service role key is correct in the .env file

**If teachers can't log in:**
- Check that the username field was added to the profiles table
- Verify the auth.users table has the new teacher record
- Make sure the fake email format is consistent

**If the SuperAdmin form doesn't work:**
- Check browser console for errors
- Verify the database functions were created successfully
- Test the RPC call manually in Supabase

The system should now be ready for username-based teacher creation! 🎉