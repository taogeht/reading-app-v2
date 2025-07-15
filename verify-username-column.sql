-- Verify if username column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'username';

-- If the above returns no rows, the column doesn't exist
-- Run this to add it:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Check all columns in profiles table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;