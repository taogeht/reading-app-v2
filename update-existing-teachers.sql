-- Update existing teacher records to have usernames
-- Run this AFTER adding the username column

-- Update teachers to extract username from their fake email
UPDATE profiles 
SET username = SPLIT_PART(email, '@', 1) 
WHERE role = 'teacher' 
  AND email LIKE '%@teacherlogin.internal' 
  AND username IS NULL;

-- Check the results
SELECT id, email, username, full_name, role 
FROM profiles 
WHERE role = 'teacher';