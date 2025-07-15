-- FIX STUDENT CLASS ACCESS: Add missing columns and fix queries
-- This fixes the 406 Not Acceptable error when students try to access classes

-- =============================================================================
-- STEP 1: ADD MISSING COLUMNS TO CLASSES TABLE
-- =============================================================================

-- Add allow_student_access column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'allow_student_access') THEN
        ALTER TABLE public.classes ADD COLUMN allow_student_access BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added allow_student_access column to classes table';
    END IF;
END $$;

-- Update existing classes to allow student access by default
UPDATE public.classes 
SET allow_student_access = true 
WHERE allow_student_access IS NULL;

-- =============================================================================
-- STEP 2: ENSURE ACCESS_TOKEN COLUMN HAS PROPER VALUES
-- =============================================================================

-- Update any classes without access tokens to have one
UPDATE public.classes 
SET access_token = UPPER(LEFT(MD5(RANDOM()::TEXT), 8))
WHERE access_token IS NULL OR access_token = '';

-- =============================================================================
-- STEP 3: CREATE TEST DATA FOR DEVELOPMENT
-- =============================================================================

-- Create a test class with the specific access token from the URL
INSERT INTO public.classes (
    id,
    name,
    grade_level,
    teacher_id,
    access_token,
    allow_student_access,
    is_active,
    school_year,
    description,
    max_students,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'Test Reading Class',
    2,
    (SELECT id FROM public.profiles WHERE role = 'teacher' LIMIT 1), -- Use first teacher
    '20BB542A',
    true,
    true,
    '2024-2025',
    'A test class for debugging the visual password login flow',
    25,
    NOW(),
    NOW()
) ON CONFLICT (access_token) DO UPDATE SET
    name = EXCLUDED.name,
    allow_student_access = EXCLUDED.allow_student_access,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- =============================================================================
-- STEP 4: CREATE TEST STUDENTS FOR THE CLASS
-- =============================================================================

-- Get the class ID for our test class
DO $$
DECLARE
    test_class_id UUID;
    student_1_id UUID;
    student_2_id UUID;
    student_3_id UUID;
BEGIN
    -- Get the test class ID
    SELECT id INTO test_class_id FROM public.classes WHERE access_token = '20BB542A';
    
    IF test_class_id IS NOT NULL THEN
        -- Create test students (only if they don't exist)
        
        -- Student 1: Emma
        student_1_id := gen_random_uuid();
        INSERT INTO public.profiles (
            id, email, full_name, role, class_id, visual_password_id, is_active, created_at, updated_at
        ) VALUES (
            student_1_id, 'emma.test@school.edu', 'Emma Johnson', 'student', test_class_id, 'cat', true, NOW(), NOW()
        ) ON CONFLICT (email) DO NOTHING;
        
        -- Student 2: Alex
        student_2_id := gen_random_uuid();
        INSERT INTO public.profiles (
            id, email, full_name, role, class_id, visual_password_id, is_active, created_at, updated_at
        ) VALUES (
            student_2_id, 'alex.test@school.edu', 'Alex Martinez', 'student', test_class_id, 'dog', true, NOW(), NOW()
        ) ON CONFLICT (email) DO NOTHING;
        
        -- Student 3: Sam
        student_3_id := gen_random_uuid();
        INSERT INTO public.profiles (
            id, email, full_name, role, class_id, visual_password_id, is_active, created_at, updated_at
        ) VALUES (
            student_3_id, 'sam.test@school.edu', 'Sam Wilson', 'student', test_class_id, 'red', true, NOW(), NOW()
        ) ON CONFLICT (email) DO NOTHING;
        
        RAISE NOTICE 'Created test students for class %', test_class_id;
    ELSE
        RAISE NOTICE 'Test class not found - unable to create students';
    END IF;
END $$;

-- =============================================================================
-- STEP 5: VERIFY THE SETUP
-- =============================================================================

-- Test the class access query (this should work now)
SELECT 'Testing class access query:' as info;
SELECT id, name, grade_level, access_token, allow_student_access
FROM public.classes 
WHERE access_token = '20BB542A' 
AND is_active = true 
AND allow_student_access = true;

-- Show students in the test class
SELECT 'Students in test class:' as info;
SELECT p.id, p.full_name, p.visual_password_id, c.name as class_name
FROM public.profiles p
JOIN public.classes c ON c.id = p.class_id
WHERE c.access_token = '20BB542A' AND p.role = 'student';

-- Show visual passwords available
SELECT 'Available visual passwords:' as info;
SELECT id, name, category, display_emoji
FROM public.visual_passwords
ORDER BY category, name
LIMIT 10;

SELECT 'Student class access should now work at http://localhost:5173/class/20BB542A!' as final_status;