
-- Generated Admin Account Creation Script
-- Created: 2025-09-06T23:47:43.459Z
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
    '73592d20-9218-467c-88af-9f81c196fc72',
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
    'c7cabc67-f68e-4ea4-a677-027c972992ba',
    '73592d20-9218-467c-88af-9f81c196fc72',
    'bryce@mschool.com.tw',
    'credential',
    '7833ff81cb4fb7e216957ac4784615864fdcad05f874263ce7d9f186eab8cce3:14b699edcf0769a9e8edeee1b2f36b6ff6d27b442dc0444abb51fe13c8cf488a4abe096b76a0bca8672f9319fbdbafcc1b78021c3666af63351dcce35072c295',
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
    '05c4c924-50f3-4783-b570-106deb362dbb',
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
