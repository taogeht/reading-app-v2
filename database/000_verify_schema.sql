-- Schema Verification Script
-- Run this to check what already exists in your database

-- =============================================================================
-- CHECK EXISTING TABLES
-- =============================================================================

SELECT 'TABLES' as type, table_name as name, 'exists' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'classes', 'assignments', 'recordings')
ORDER BY table_name;

-- =============================================================================
-- CHECK EXISTING CONSTRAINTS
-- =============================================================================

SELECT 'CONSTRAINTS' as type, conname as name, 'exists' as status
FROM pg_constraint 
WHERE conname IN (
    'profiles_class_id_fkey',
    'classes_teacher_id_fkey', 
    'assignments_class_id_fkey',
    'assignments_teacher_id_fkey',
    'recordings_student_id_fkey',
    'recordings_assignment_id_fkey'
)
ORDER BY conname;

-- =============================================================================
-- CHECK EXISTING INDEXES
-- =============================================================================

SELECT 'INDEXES' as type, indexname as name, 'exists' as status
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname LIKE '%_idx'
ORDER BY indexname;

-- =============================================================================
-- CHECK EXISTING TRIGGERS
-- =============================================================================

SELECT 'TRIGGERS' as type, trigger_name as name, 'exists' as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
OR (trigger_schema = 'auth' AND trigger_name = 'on_auth_user_created')
ORDER BY trigger_name;

-- =============================================================================
-- CHECK EXISTING FUNCTIONS
-- =============================================================================

SELECT 'FUNCTIONS' as type, routine_name as name, 'exists' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('handle_updated_at', 'handle_new_user')
ORDER BY routine_name;

-- =============================================================================
-- CHECK STORAGE BUCKET
-- =============================================================================

SELECT 'STORAGE' as type, 
       CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'recordings') 
            THEN 'recordings bucket exists' 
            ELSE 'recordings bucket missing' 
       END as name,
       'status' as status;

-- =============================================================================
-- CHECK STORAGE POLICIES
-- =============================================================================

SELECT 'STORAGE POLICIES' as type, policyname as name, 'exists' as status
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%recordings%'
ORDER BY policyname;

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT 
    'SUMMARY' as type,
    COUNT(*) as total_objects,
    'database objects found' as status
FROM (
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('profiles', 'classes', 'assignments', 'recordings')
    UNION ALL
    SELECT conname FROM pg_constraint WHERE conname LIKE '%_fkey'
    UNION ALL  
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%_idx'
    UNION ALL
    SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema IN ('public', 'auth')
) as all_objects;