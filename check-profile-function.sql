-- Check if the get_user_profile_fast function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'get_user_profile_fast';

-- Also check what profile-related functions exist
SELECT routine_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%profile%';