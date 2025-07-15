-- SAFE FIX: Visual Passwords Table - Handle existing NULL values
-- Run this to safely fix the visual_passwords table

-- =============================================================================
-- STEP 1: EXAMINE CURRENT STATE
-- =============================================================================

-- First, let's see what we're working with
SELECT 'Current visual_passwords table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'visual_passwords' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'Current data in visual_passwords:' as info;
SELECT * FROM public.visual_passwords LIMIT 5;

-- =============================================================================
-- STEP 2: SAFE COLUMN MANAGEMENT
-- =============================================================================

DO $$
BEGIN
    -- If display_emoji column doesn't exist, add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visual_passwords' AND column_name = 'display_emoji') THEN
        ALTER TABLE public.visual_passwords ADD COLUMN display_emoji TEXT;
        RAISE NOTICE 'Added display_emoji column';
    END IF;
    
    -- If there are existing records with NULL display_emoji, provide default values or delete them
    UPDATE public.visual_passwords 
    SET display_emoji = CASE 
        WHEN id = 'cat' THEN '🐱'
        WHEN id = 'dog' THEN '🐶'
        WHEN id = 'elephant' THEN '🐘'
        WHEN id = 'lion' THEN '🦁'
        WHEN id = 'butterfly' THEN '🦋'
        WHEN id = 'fish' THEN '🐠'
        WHEN id = 'star' THEN '⭐'
        WHEN id = 'heart' THEN '💖'
        WHEN id = 'circle' THEN '🔵'
        WHEN id = 'triangle' THEN '🔺'
        WHEN id = 'square' THEN '🟦'
        WHEN id = 'diamond' THEN '💎'
        WHEN id = 'sun' THEN '☀️'
        WHEN id = 'flower' THEN '🌸'
        WHEN id = 'book' THEN '📚'
        WHEN id = 'car' THEN '🚗'
        WHEN id = 'house' THEN '🏠'
        WHEN id = 'tree' THEN '🌳'
        WHEN id = 'red' THEN '🔴'
        WHEN id = 'blue' THEN '🔵'
        WHEN id = 'green' THEN '🟢'
        WHEN id = 'yellow' THEN '🟡'
        WHEN id = 'purple' THEN '🟣'
        WHEN id = 'orange' THEN '🟠'
        ELSE '❓'  -- Default emoji for unknown records
    END
    WHERE display_emoji IS NULL;
    
    -- Now it's safe to make the column NOT NULL
    ALTER TABLE public.visual_passwords ALTER COLUMN display_emoji SET NOT NULL;
    RAISE NOTICE 'Made display_emoji NOT NULL';
    
    -- Drop image_url column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visual_passwords' AND column_name = 'image_url') THEN
        ALTER TABLE public.visual_passwords DROP COLUMN image_url;
        RAISE NOTICE 'Dropped image_url column';
    END IF;
    
END $$;

-- =============================================================================
-- STEP 3: ENSURE ALL REQUIRED RECORDS EXIST
-- =============================================================================

-- Insert missing records (ON CONFLICT DO NOTHING prevents duplicates)
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
    ('orange', 'colors', 'Orange', '🟠')
ON CONFLICT (id) DO UPDATE SET
    category = EXCLUDED.category,
    name = EXCLUDED.name,
    display_emoji = EXCLUDED.display_emoji;

-- =============================================================================
-- STEP 4: SET UP FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Add foreign key constraints safely
DO $$
BEGIN
    -- profiles -> visual_passwords foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_visual_password_fkey'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_visual_password_fkey 
        FOREIGN KEY (visual_password_id) REFERENCES public.visual_passwords(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added profiles foreign key constraint';
    END IF;
    
    -- class_sessions -> visual_passwords foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'class_sessions_visual_password_fkey'
    ) THEN
        ALTER TABLE public.class_sessions 
        ADD CONSTRAINT class_sessions_visual_password_fkey 
        FOREIGN KEY (visual_password_id) REFERENCES public.visual_passwords(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added class_sessions foreign key constraint';
    END IF;
END $$;

-- =============================================================================
-- STEP 5: ENABLE RLS (if not already enabled)
-- =============================================================================

ALTER TABLE public.visual_passwords ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 6: VERIFICATION
-- =============================================================================

SELECT 'FINAL VERIFICATION - Table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'visual_passwords' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'FINAL VERIFICATION - Record count:' as info;
SELECT COUNT(*) as total_visual_passwords FROM public.visual_passwords;

SELECT 'FINAL VERIFICATION - Sample data:' as info;
SELECT id, category, name, display_emoji 
FROM public.visual_passwords 
ORDER BY category, name 
LIMIT 10;