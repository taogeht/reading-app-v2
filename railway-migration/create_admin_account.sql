
-- Generated Admin Account Creation Script
-- Created: 2025-09-07T06:13:17.210Z
-- Email: bryce@mschool.com.tw

-- Clean up any existing records (optional - remove if you want to keep existing data)
DELETE FROM account WHERE user_id IN (SELECT id FROM "user" WHERE email = 'bryce@mschool.com.tw');
DELETE FROM profiles WHERE email = 'bryce@mschool.com.tw';  
DELETE FROM "user" WHERE email = 'bryce@mschool.com.tw';

-- Create BetterAuth user record
INSERT INTO "user" (
    id,
    email,
    name,
    username,
    role,
    email_verified,
    created_at,
    updated_at
) VALUES (
    '9d81adcd-786f-4282-8156-e6b99330b5dd',
    'bryce@mschool.com.tw',
    'System Administrator',
    'brycev',
    'admin',
    true,
    NOW(),
    NOW()
);

-- Create BetterAuth account record with hashed password
INSERT INTO account (
    id,
    user_id,
    account_id,
    provider,
    password,
    created_at,
    updated_at
) VALUES (
    '5f230bb8-e065-4388-a530-935a374e6b36',
    '9d81adcd-786f-4282-8156-e6b99330b5dd',
    'bryce@mschool.com.tw',
    'credential',
    '05d75deef3d3863c0d962ab8bc4e431b45183a5f77564b3003f18f8d54f7b977:79eb6ac9396398457baa18bb03b2c1fde8968d585dde97d1c20b19b71fc266099061ad0d4e1dfa51d04ce69f5c14851b09dbaf010564a817de9c1c834fceeb82',
    NOW(),
    NOW()
);

-- Create profiles record (your app-specific user data)
INSERT INTO profiles (
    id,
    email,
    username,
    full_name,
    role,
    created_at,
    updated_at
) VALUES (
    'e29ce51f-cb11-46c2-b883-ec9c33345038',
    'bryce@mschool.com.tw',
    'brycev',
    'System Administrator',
    'admin',
    NOW(),
    NOW()
);

-- Verify the account was created successfully
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.role as user_role,
    a.provider,
    CASE WHEN a.password IS NOT NULL THEN 'Password Set ✅' ELSE 'No Password ❌' END as password_status,
    p.role as profile_role
FROM "user" u
LEFT JOIN account a ON u.id = a.user_id  
LEFT JOIN profiles p ON u.email = p.email
WHERE u.email = 'bryce@mschool.com.tw';

-- Success message
SELECT '🎉 Admin account created successfully! You can now login with:' as status;
SELECT 'Email: bryce@mschool.com.tw' as login_email;
SELECT 'Password: [your-configured-password]' as login_password;
SELECT 'Access: https://your-app.com/teacher (then navigate to /admin)' as access_url;
