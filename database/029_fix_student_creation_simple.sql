-- FIX STUDENT CREATION - SIMPLE APPROACH: Remove foreign key constraint for profiles table
-- This fixes the session_replication_role permission error by modifying the table structure

-- =============================================================================
-- STEP 1: UNDERSTAND THE CURRENT CONSTRAINT
-- =============================================================================

-- Check current foreign key constraint on profiles table
SELECT 'Current foreign key constraints on profiles:' as info;
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.profiles'::regclass 
AND contype = 'f';

-- =============================================================================
-- STEP 2: DROP THE FOREIGN KEY CONSTRAINT (TEMPORARILY)
-- =============================================================================

-- For a reading app with elementary students, we don't need every profile to have an auth user
-- Students will use visual passwords, teachers will use email/password

-- Drop the foreign key constraint that requires profiles.id to exist in auth.users.id
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'public.profiles'::regclass 
    AND contype = 'f'
    AND confrelid = 'auth.users'::regclass
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped foreign key constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No foreign key constraint found on profiles table';
    END IF;
END $$;

-- =============================================================================
-- STEP 3: CREATE SIMPLE STUDENT CREATION FUNCTION
-- =============================================================================

-- Now create a simple function that doesn't need session manipulation
CREATE OR REPLACE FUNCTION public.create_student_profile_simple(
    student_email TEXT,
    student_name TEXT,
    student_class_id UUID,
    visual_password_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_student_id UUID;
BEGIN
    -- Check admin access
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can create students';
    END IF;
    
    -- Validate inputs
    IF student_email IS NULL OR TRIM(student_email) = '' THEN
        RAISE EXCEPTION 'Student email is required';
    END IF;
    
    IF student_name IS NULL OR TRIM(student_name) = '' THEN
        RAISE EXCEPTION 'Student name is required';
    END IF;
    
    IF student_class_id IS NULL THEN
        RAISE EXCEPTION 'Class ID is required';
    END IF;
    
    -- Verify class exists
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = student_class_id AND is_active = true) THEN
        RAISE EXCEPTION 'Invalid or inactive class ID';
    END IF;
    
    -- Check if visual password exists (if provided)
    IF visual_password_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.visual_passwords WHERE id = visual_password_id) THEN
            RAISE EXCEPTION 'Invalid visual password ID';
        END IF;
    END IF;
    
    -- Generate new UUID
    new_student_id := gen_random_uuid();
    
    -- Simple insert - no foreign key constraint to worry about
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        class_id,
        visual_password_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        new_student_id,
        TRIM(student_email),
        TRIM(student_name),
        'student',
        student_class_id,
        visual_password_id,
        true,
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created student profile for % with ID %', student_name, new_student_id;
    RETURN new_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_student_profile_simple TO authenticated;

-- =============================================================================
-- STEP 4: UPDATE TEACHER CREATION TO HANDLE AUTH PROPERLY
-- =============================================================================

-- For teachers, we still want auth users, but let's make it more robust
CREATE OR REPLACE FUNCTION public.create_teacher_profile_simple(
    teacher_id UUID,
    teacher_email TEXT,
    teacher_name TEXT
)
RETURNS UUID AS $$
BEGIN
    -- Check admin access
    IF NOT public.is_admin_simple() THEN
        RAISE EXCEPTION 'Only admins can create teachers';
    END IF;
    
    -- Simple insert for teacher profile
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        teacher_id,
        TRIM(teacher_email),
        TRIM(teacher_name),
        'teacher',
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();
    
    RAISE NOTICE 'Created/updated teacher profile for % with ID %', teacher_name, teacher_id;
    RETURN teacher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_teacher_profile_simple TO authenticated;

-- =============================================================================
-- STEP 5: TEST THE NEW FUNCTION
-- =============================================================================

-- Test the new simple function
SELECT 'Testing simple student creation:' as info;

DO $$
DECLARE
    test_class_id UUID;
    test_student_id UUID;
BEGIN
    -- Find a class to test with
    SELECT id INTO test_class_id FROM public.classes WHERE is_active = true LIMIT 1;
    
    IF test_class_id IS NOT NULL THEN
        BEGIN
            -- Test the simple version
            SELECT public.create_student_profile_simple(
                'test.student@example.com',
                'Test Student',
                test_class_id
            ) INTO test_student_id;
            
            RAISE NOTICE 'SUCCESS: Created test student with ID %', test_student_id;
            
            -- Clean up
            DELETE FROM public.profiles WHERE id = test_student_id;
            RAISE NOTICE 'Cleaned up test student';
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'FAILED: Student creation test failed: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'No active class found for testing';
    END IF;
END $$;

-- =============================================================================
-- STEP 6: VERIFICATION
-- =============================================================================

-- Check that the constraint is gone
SELECT 'Verifying constraint removal:' as info;
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table
FROM pg_constraint 
WHERE conrelid = 'public.profiles'::regclass 
AND contype = 'f';

-- Show that we can now insert profiles without auth users
SELECT 'Student creation should now work without foreign key constraints!' as final_status;