-- FIX ADMIN_CREATE_CLASS 400 ERROR: Ensure function works with exact parameters from frontend
-- This fixes the 400 Bad Request error when creating classes

-- =============================================================================
-- STEP 1: ENSURE ALL DEPENDENCIES EXIST
-- =============================================================================

-- Ensure is_admin_simple function exists
CREATE OR REPLACE FUNCTION public.is_admin_simple()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin',
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_admin_simple TO authenticated;

-- =============================================================================
-- STEP 2: VERIFY CLASSES TABLE STRUCTURE
-- =============================================================================

-- Check if classes table has all required columns
SELECT 'Checking classes table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'classes' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add school_year column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'school_year') THEN
        ALTER TABLE public.classes ADD COLUMN school_year TEXT DEFAULT '2024-2025';
        RAISE NOTICE 'Added school_year column to classes table';
    END IF;
    
    -- Add description column if missing  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'description') THEN
        ALTER TABLE public.classes ADD COLUMN description TEXT DEFAULT '';
        RAISE NOTICE 'Added description column to classes table';
    END IF;
    
    -- Add max_students column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'max_students') THEN
        ALTER TABLE public.classes ADD COLUMN max_students INTEGER DEFAULT 25;
        RAISE NOTICE 'Added max_students column to classes table';
    END IF;
    
    -- Add access_token column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'access_token') THEN
        ALTER TABLE public.classes ADD COLUMN access_token TEXT;
        RAISE NOTICE 'Added access_token column to classes table';
    END IF;
END $$;

-- =============================================================================
-- STEP 3: DROP AND RECREATE admin_create_class FUNCTION
-- =============================================================================

-- Drop existing function (all variations)
DROP FUNCTION IF EXISTS public.admin_create_class(TEXT, INTEGER, UUID, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.admin_create_class(TEXT, INTEGER, UUID);

-- Create the function with EXACT parameters matching databaseService.ts call
CREATE OR REPLACE FUNCTION public.admin_create_class(
    class_name TEXT,
    class_grade_level INTEGER,
    class_teacher_id UUID,
    class_school_year TEXT DEFAULT '2024-2025',
    class_description TEXT DEFAULT '',
    class_max_students INTEGER DEFAULT 25
)
RETURNS UUID AS $$
DECLARE
    new_class_id UUID;
    generated_token TEXT;
BEGIN
    -- Validate admin access
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can create classes';
    END IF;
    
    -- Validate required parameters
    IF class_name IS NULL OR TRIM(class_name) = '' THEN
        RAISE EXCEPTION 'Class name is required';
    END IF;
    
    IF class_grade_level IS NULL OR class_grade_level < 1 OR class_grade_level > 12 THEN
        RAISE EXCEPTION 'Grade level must be between 1 and 12';
    END IF;
    
    IF class_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Teacher ID is required';
    END IF;
    
    -- Verify teacher exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = class_teacher_id 
        AND role = 'teacher' 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Invalid or inactive teacher ID';
    END IF;
    
    -- Generate a simple access token (8 characters)
    generated_token := UPPER(LEFT(MD5(RANDOM()::TEXT), 8));
    
    -- Insert the new class
    INSERT INTO public.classes (
        name,
        grade_level,
        teacher_id,
        school_year,
        description,
        max_students,
        access_token,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        TRIM(class_name),
        class_grade_level,
        class_teacher_id,
        COALESCE(NULLIF(TRIM(class_school_year), ''), '2024-2025'),
        COALESCE(TRIM(class_description), ''),
        COALESCE(class_max_students, 25),
        generated_token,
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO new_class_id;
    
    -- Log successful creation
    RAISE NOTICE 'Created class "%" with ID % for teacher %', class_name, new_class_id, class_teacher_id;
    
    RETURN new_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.admin_create_class TO authenticated;

-- =============================================================================
-- STEP 4: ENSURE PROPER RLS POLICIES FOR CLASS CREATION
-- =============================================================================

-- Make sure classes table has proper admin policy
DROP POLICY IF EXISTS "Admin full access to classes" ON public.classes;
CREATE POLICY "Admin full access to classes" ON public.classes
    FOR ALL USING (public.is_admin_simple());

-- =============================================================================
-- STEP 5: TEST THE FUNCTION WITH REALISTIC DATA
-- =============================================================================

-- Test function signature and basic validation
SELECT 'Testing admin_create_class function:' as info;

DO $$
DECLARE
    test_class_id UUID;
    test_teacher_id UUID;
BEGIN
    -- Try to find an existing teacher for testing
    SELECT id INTO test_teacher_id 
    FROM public.profiles 
    WHERE role = 'teacher' 
    AND is_active = true 
    LIMIT 1;
    
    IF test_teacher_id IS NOT NULL THEN
        -- Test function with minimal parameters (should work)
        BEGIN
            SELECT public.admin_create_class(
                'Test Class ' || EXTRACT(epoch from NOW())::TEXT,
                1,
                test_teacher_id
            ) INTO test_class_id;
            
            RAISE NOTICE 'SUCCESS: Created test class with ID %', test_class_id;
            
            -- Clean up test class
            DELETE FROM public.classes WHERE id = test_class_id;
            RAISE NOTICE 'Cleaned up test class';
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'FAILED: admin_create_class test failed: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'No active teacher found for testing - skipping function test';
    END IF;
END $$;

-- =============================================================================
-- STEP 6: VERIFY FUNCTION PARAMETERS MATCH FRONTEND CALL
-- =============================================================================

-- Show function signature
SELECT 'Function signature verification:' as info;
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'admin_create_class';

-- =============================================================================
-- STEP 7: FINAL VERIFICATION
-- =============================================================================

-- Check that function exists and has correct permissions
SELECT 'Final verification:' as info;
SELECT 
    proname as function_name,
    proacl as permissions
FROM pg_proc 
WHERE proname = 'admin_create_class' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT 'admin_create_class function should now work - 400 error fixed!' as final_status;