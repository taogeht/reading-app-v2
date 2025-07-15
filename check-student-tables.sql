-- Check if student-related tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('class_sessions', 'visual_passwords');

-- Check if set_config function exists
SELECT routine_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'set_config';