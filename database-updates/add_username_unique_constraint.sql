-- Add unique constraint for teacher usernames
-- Since we now use username-based authentication for teachers,
-- ensure usernames are unique to prevent authentication conflicts

-- First, verify current state
SELECT 
    username, 
    role, 
    COUNT(*) as count
FROM profiles 
WHERE username IS NOT NULL 
GROUP BY username, role 
HAVING COUNT(*) > 1;

-- The username column already exists and has UNIQUE constraint
-- But let's add a partial unique index specifically for teachers to be explicit
-- This ensures username uniqueness only for teachers (allows NULL for students/admins)

CREATE UNIQUE INDEX IF NOT EXISTS profiles_teacher_username_unique 
ON profiles (username) 
WHERE role = 'teacher' AND username IS NOT NULL;

-- Verify the constraint is working
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'profiles' 
AND indexname LIKE '%username%';

-- Also add an index for username lookups for performance
CREATE INDEX IF NOT EXISTS profiles_username_lookup_idx 
ON profiles (username) 
WHERE username IS NOT NULL;

SELECT 'Username constraints added successfully for teacher authentication' as status;