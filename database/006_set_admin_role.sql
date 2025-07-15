-- Set a specific user as admin
-- Replace 'your-email@example.com' with your actual email address

-- =============================================================================
-- UPDATE SPECIFIC USER TO ADMIN ROLE
-- =============================================================================

-- Method 1: Update by email (replace with your email)
UPDATE public.profiles 
SET role = 'admin', is_active = true 
WHERE email = 'your-email@example.com';

-- Method 2: Update by user ID (if you know your user ID)
-- UPDATE public.profiles 
-- SET role = 'admin', is_active = true 
-- WHERE id = 'your-user-id-here';

-- =============================================================================
-- ALSO UPDATE THE AUTH.USERS METADATA
-- =============================================================================

-- Update the auth.users metadata to include admin role
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'your-email@example.com';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check your profile
SELECT id, email, full_name, role, is_active, created_at 
FROM public.profiles 
WHERE email = 'your-email@example.com';

-- Check auth.users metadata
SELECT id, email, raw_user_meta_data 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- =============================================================================
-- UPDATED TRIGGER FUNCTION (OPTIONAL)
-- =============================================================================

-- Update the trigger function to better handle admin creation
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