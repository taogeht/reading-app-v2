-- DIAGNOSTIC: Examine current visual_passwords table structure
-- Run this first to understand what we're working with

-- =============================================================================
-- EXAMINE TABLE STRUCTURE
-- =============================================================================

SELECT '=== VISUAL PASSWORDS TABLE STRUCTURE ===' as info;

-- Get detailed column information
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'visual_passwords' AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- EXAMINE CONSTRAINTS
-- =============================================================================

SELECT '=== TABLE CONSTRAINTS ===' as info;

-- Get all constraints on the table
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints
WHERE table_name = 'visual_passwords' AND table_schema = 'public';

-- Get check constraints details
SELECT 
    cc.constraint_name,
    cc.check_clause
FROM information_schema.check_constraints cc
JOIN information_schema.constraint_table_usage ctu 
    ON cc.constraint_name = ctu.constraint_name
WHERE ctu.table_name = 'visual_passwords';

-- =============================================================================
-- EXAMINE CURRENT DATA
-- =============================================================================

SELECT '=== CURRENT DATA SAMPLE ===' as info;

-- Get current records (if any)
SELECT * FROM public.visual_passwords LIMIT 10;

SELECT '=== DATA COUNT ===' as info;
SELECT COUNT(*) as total_records FROM public.visual_passwords;

-- =============================================================================
-- EXAMINE FOREIGN KEY REFERENCES
-- =============================================================================

SELECT '=== FOREIGN KEY REFERENCES TO THIS TABLE ===' as info;

-- Find what tables reference visual_passwords
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'visual_passwords';

-- =============================================================================
-- EXAMINE INDEXES
-- =============================================================================

SELECT '=== INDEXES ON TABLE ===' as info;

-- Get indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'visual_passwords' AND schemaname = 'public';

-- =============================================================================
-- PROPOSED COLUMN MAPPING
-- =============================================================================

SELECT '=== SUGGESTED COLUMN MAPPING ===' as info;

-- This is what we want our table to look like
SELECT 'Our target structure should be:' as suggestion
UNION ALL
SELECT 'id TEXT PRIMARY KEY'
UNION ALL  
SELECT 'category TEXT NOT NULL'
UNION ALL
SELECT 'name TEXT NOT NULL'  
UNION ALL
SELECT 'display_emoji TEXT NOT NULL'
UNION ALL
SELECT 'created_at TIMESTAMPTZ DEFAULT now()';