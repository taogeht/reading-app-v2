-- Add Missing Username Column
-- This migration adds the username column that should exist but might be missing

-- ===================================================================
-- ADD USERNAME COLUMN IF MISSING
-- ===================================================================

-- Add username column to profiles table (safe if already exists)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Create index for username lookups (safe if already exists)  
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Add comment
COMMENT ON COLUMN public.profiles.username IS 'Unique username for login (optional for teachers)';

-- ===================================================================
-- VERIFICATION
-- ===================================================================

-- Check that username column exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'username';

-- Check current profiles structure
SELECT 
    'Profiles table structure:' as info;
    
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ===================================================================
-- COMMENTS
-- ===================================================================

/*
This migration ensures the username column exists in the profiles table.

ISSUE:
- Application code expects username column to exist
- Queries like 'select id, username, email' were failing with 406 errors
- Username column was defined in migrations but might not be applied

SOLUTION:
- Add username column if missing (safe operation)
- Add index for performance
- Keep it optional (nullable) to maintain compatibility

RESULT:
- 406 "Not Acceptable" errors should be resolved
- Application can select username without errors
- Maintains backward compatibility
*/