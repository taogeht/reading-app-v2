-- Add Personal Admin Account
-- Replace the email and details below with your personal information
-- This script is safe to run multiple times (uses ON CONFLICT DO NOTHING)

-- Add your personal admin account
-- CHANGE THESE VALUES TO YOUR PERSONAL DETAILS:
INSERT INTO profiles (
    id, 
    email, 
    username, 
    full_name, 
    role, 
    created_at, 
    updated_at
) VALUES (
    gen_random_uuid(),
    'your-email@example.com',           -- 🔄 CHANGE THIS to your email
    'your-username',                     -- 🔄 CHANGE THIS to your preferred username  
    'Your Full Name',                    -- 🔄 CHANGE THIS to your full name
    'admin',
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    role = 'admin',                      -- Ensure admin role if account already exists
    updated_at = NOW();

-- Verify the admin account was created
SELECT 
    id,
    email,
    username,
    full_name,
    role,
    created_at
FROM profiles 
WHERE role = 'admin'
ORDER BY created_at DESC;

-- Optional: Remove the default admin account if you don't need it
-- Uncomment the line below if you want to remove the generic admin account
-- DELETE FROM profiles WHERE email = 'admin@readingapp.com';