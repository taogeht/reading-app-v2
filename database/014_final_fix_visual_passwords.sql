-- FINAL FIX: Visual Passwords Table Structure
-- Run this to fix the visual_passwords table column issue

-- =============================================================================
-- FIX VISUAL PASSWORDS TABLE STRUCTURE
-- =============================================================================

-- Check if visual_passwords table exists and what columns it has
DO $$
BEGIN
    -- If table doesn't exist, create it with correct structure
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'visual_passwords') THEN
        CREATE TABLE public.visual_passwords (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL CHECK (category IN ('animals', 'shapes', 'objects', 'colors')),
            name TEXT NOT NULL,
            display_emoji TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
    ELSE
        -- Table exists, check if display_emoji column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visual_passwords' AND column_name = 'display_emoji') THEN
            -- Add display_emoji column if it doesn't exist
            ALTER TABLE public.visual_passwords ADD COLUMN display_emoji TEXT;
            
            -- If there was an image_url column, we can drop it
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visual_passwords' AND column_name = 'image_url') THEN
                ALTER TABLE public.visual_passwords DROP COLUMN image_url;
            END IF;
            
            -- Make display_emoji NOT NULL after adding it
            ALTER TABLE public.visual_passwords ALTER COLUMN display_emoji SET NOT NULL;
        END IF;
    END IF;
END $$;

-- =============================================================================
-- CLEAR AND INSERT SAMPLE VISUAL PASSWORDS
-- =============================================================================

-- Clear existing data to avoid conflicts
DELETE FROM public.visual_passwords;

-- Insert sample visual passwords with correct structure
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
-- FIX FOREIGN KEY CONSTRAINTS FOR VISUAL PASSWORDS
-- =============================================================================

-- Add visual_password_id foreign key to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_visual_password_fkey'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_visual_password_fkey 
        FOREIGN KEY (visual_password_id) REFERENCES public.visual_passwords(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add visual_password_id foreign key to class_sessions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'class_sessions_visual_password_fkey'
    ) THEN
        ALTER TABLE public.class_sessions 
        ADD CONSTRAINT class_sessions_visual_password_fkey 
        FOREIGN KEY (visual_password_id) REFERENCES public.visual_passwords(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY FOR VISUAL PASSWORDS
-- =============================================================================

ALTER TABLE public.visual_passwords ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check visual_passwords table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'visual_passwords' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check that sample data was inserted
SELECT COUNT(*) as visual_password_count FROM public.visual_passwords;

-- Check sample data
SELECT id, category, name, display_emoji FROM public.visual_passwords ORDER BY category, name;