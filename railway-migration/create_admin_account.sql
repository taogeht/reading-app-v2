
-- Generated Admin Account Creation Script
-- Created: 2025-09-06T23:49:59.881Z
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
    '8e07d876-0c27-4c99-82ed-d7ef8c268761',
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
    '31afaea4-78f7-43a2-8174-4e6e36951d03',
    '8e07d876-0c27-4c99-82ed-d7ef8c268761',
    'bryce@mschool.com.tw',
    'credential',
    '1fb608d9311f98e80ebe9995f749f6c0f7897b8fbd0c1f0c53d88ad678d690bf:29219721c5c8682a4257d95afcd7af288fa00aea76042fb9e99f89cb495632c693e0b924b155e6060268328dc503ba826920633d36cda3495e1d4444ea7c79b3',
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
    '77597fd9-9069-4b48-9b08-abed8be560cf',
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
