-- COMPREHENSIVE FIX: Visual Passwords Table
-- Run this AFTER examining the structure with 016_examine_visual_passwords_structure.sql

-- =============================================================================
-- STEP 1: BACKUP EXISTING DATA (if any)
-- =============================================================================

-- Create a temporary backup table
CREATE TABLE IF NOT EXISTS visual_passwords_backup AS 
SELECT * FROM public.visual_passwords WHERE false; -- Empty structure copy

-- Copy any existing data
INSERT INTO visual_passwords_backup 
SELECT * FROM public.visual_passwords;

SELECT 'Backed up existing data. Records backed up:' as info, COUNT(*) as count 
FROM visual_passwords_backup;

-- =============================================================================
-- STEP 2: DROP FOREIGN KEY CONSTRAINTS TEMPORARILY
-- =============================================================================

-- Drop foreign keys that reference visual_passwords
DO $$
BEGIN
    -- Drop profiles foreign key if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_visual_password_fkey'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_visual_password_fkey;
        RAISE NOTICE 'Dropped profiles foreign key constraint';
    END IF;
    
    -- Drop class_sessions foreign key if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'class_sessions_visual_password_fkey'
    ) THEN
        ALTER TABLE public.class_sessions DROP CONSTRAINT class_sessions_visual_password_fkey;
        RAISE NOTICE 'Dropped class_sessions foreign key constraint';
    END IF;
END $$;

-- =============================================================================
-- STEP 3: RECREATE TABLE WITH CORRECT STRUCTURE
-- =============================================================================

-- Drop the problematic table
DROP TABLE IF EXISTS public.visual_passwords CASCADE;

-- Create with the correct structure we need
CREATE TABLE public.visual_passwords (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('animals', 'shapes', 'objects', 'colors')),
    name TEXT NOT NULL,
    display_emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- STEP 4: INSERT CORRECT DATA
-- =============================================================================

-- Insert all the visual passwords we need
INSERT INTO public.visual_passwords (id, category, name, display_emoji) VALUES
    ('cat', 'animals', 'Cat', '🐱'),
    ('dog', 'animals', 'Dog', '🐶'),
    ('elephant', 'animals', 'Elephant', '🐘'),
    ('lion', 'animals', 'Lion', '🦁'),
    ('butterfly', 'animals', 'Butterfly', '🦋'),
    ('fish', 'animals', 'Fish', '🐠'),
    ('star', 'shapes', 'Star', '⭐'),
    ('heart', 'shapes', 'Heart', '💖'),
    ('circle', 'shapes', 'Circle', '🔵'),
    ('triangle', 'shapes', 'Triangle', '🔺'),
    ('square', 'shapes', 'Square', '🟦'),
    ('diamond', 'shapes', 'Diamond', '💎'),
    ('sun', 'objects', 'Sun', '☀️'),
    ('flower', 'objects', 'Flower', '🌸'),
    ('book', 'objects', 'Book', '📚'),
    ('car', 'objects', 'Car', '🚗'),
    ('house', 'objects', 'House', '🏠'),
    ('tree', 'objects', 'Tree', '🌳'),
    ('red', 'colors', 'Red', '🔴'),
    ('blue', 'colors', 'Blue', '🔵'),
    ('green', 'colors', 'Green', '🟢'),
    ('yellow', 'colors', 'Yellow', '🟡'),
    ('purple', 'colors', 'Purple', '🟣'),
    ('orange', 'colors', 'Orange', '🟠');

-- =============================================================================
-- STEP 5: RESTORE FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Add back the foreign key constraints (only if columns exist)
DO $$
BEGIN
    -- Add profiles foreign key if visual_password_id column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'visual_password_id') THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_visual_password_fkey 
        FOREIGN KEY (visual_password_id) REFERENCES public.visual_passwords(id) ON DELETE SET NULL;
        RAISE NOTICE 'Restored profiles foreign key constraint';
    ELSE
        RAISE NOTICE 'Skipped profiles foreign key - visual_password_id column does not exist';
    END IF;
    
    -- Add class_sessions foreign key if visual_password_id column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_sessions' AND column_name = 'visual_password_id') THEN
        ALTER TABLE public.class_sessions 
        ADD CONSTRAINT class_sessions_visual_password_fkey 
        FOREIGN KEY (visual_password_id) REFERENCES public.visual_passwords(id) ON DELETE SET NULL;
        RAISE NOTICE 'Restored class_sessions foreign key constraint';
    ELSE
        RAISE NOTICE 'Skipped class_sessions foreign key - visual_password_id column does not exist';
    END IF;
END $$;

-- =============================================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.visual_passwords ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for visual_passwords
CREATE POLICY "Public read visual passwords" ON public.visual_passwords
    FOR SELECT USING (true);

CREATE POLICY "Admin insert visual passwords" ON public.visual_passwords
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admin update visual passwords" ON public.visual_passwords
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admin delete visual passwords" ON public.visual_passwords
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- =============================================================================
-- STEP 7: CREATE USEFUL INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_visual_passwords_category ON public.visual_passwords(category);

-- =============================================================================
-- STEP 8: CLEANUP
-- =============================================================================

-- Drop the backup table since we don't need it anymore
DROP TABLE IF EXISTS visual_passwords_backup;

-- =============================================================================
-- STEP 9: VERIFICATION
-- =============================================================================

SELECT '=== FINAL VERIFICATION ===' as info;

-- Check table structure
SELECT 'Table Structure:' as check_type;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'visual_passwords' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check data count
SELECT 'Data Count:' as check_type;
SELECT COUNT(*) as total_visual_passwords FROM public.visual_passwords;

-- Check sample data
SELECT 'Sample Data:' as check_type;
SELECT id, category, name, display_emoji 
FROM public.visual_passwords 
ORDER BY category, name 
LIMIT 10;

-- Check constraints
SELECT 'Constraints:' as check_type;
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'visual_passwords' AND table_schema = 'public';

-- Check foreign keys
SELECT 'Foreign Key References:' as check_type;
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'visual_passwords';

SELECT 'Visual passwords table is now ready!' as final_status;