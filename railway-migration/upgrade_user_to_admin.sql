-- Upgrade User to Admin Role
-- After registering through the app UI, run this script to make yourself an admin

-- STEP 1: Replace 'your-email@example.com' with your actual email address
-- STEP 2: Run this script via Railway CLI or psql

-- Upgrade user to admin role
UPDATE "user" 
SET role = 'admin'
WHERE email = 'your-email@example.com';  -- 🔄 CHANGE THIS to your email

-- Also update in profiles table (in case of sync issues)
UPDATE profiles 
SET role = 'admin', updated_at = NOW()
WHERE email = 'your-email@example.com';  -- 🔄 CHANGE THIS to your email

-- Verify the admin upgrade worked
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.role as user_role,
    p.id as profile_id,
    p.full_name,
    p.role as profile_role,
    p.updated_at
FROM "user" u
LEFT JOIN profiles p ON u.email = p.email
WHERE u.email = 'your-email@example.com'  -- 🔄 CHANGE THIS to your email
OR p.email = 'your-email@example.com';    -- 🔄 CHANGE THIS to your email

-- Check if account record exists (should show password hash)
SELECT 
    account_id,
    provider,
    CASE WHEN password IS NOT NULL THEN 'Password Set ✅' ELSE 'No Password ❌' END as password_status
FROM account a
JOIN "user" u ON a.user_id = u.id
WHERE u.email = 'your-email@example.com'; -- 🔄 CHANGE THIS to your email