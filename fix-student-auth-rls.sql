-- Create a public function for student authentication (bypasses RLS)
CREATE OR REPLACE FUNCTION public.authenticate_student_access(
    class_access_token_param TEXT,
    student_name_param TEXT,
    visual_password_id_param TEXT
)
RETURNS JSON AS $$
DECLARE
    class_record RECORD;
    student_record RECORD;
    new_student_id UUID;
    session_token TEXT;
    expires_at TIMESTAMPTZ;
    result JSON;
BEGIN
    -- Find the class by access token
    SELECT id, name, grade_level INTO class_record
    FROM public.classes
    WHERE access_token = class_access_token_param
      AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Class not found'
        );
    END IF;
    
    -- Look for existing student with this name in this class
    SELECT id, full_name, class_id INTO student_record
    FROM public.profiles
    WHERE full_name = student_name_param
      AND class_id = class_record.id
      AND role = 'student'
      AND is_active = true;
    
    IF FOUND THEN
        -- Student exists, use their ID
        new_student_id := student_record.id;
    ELSE
        -- Create new student profile
        new_student_id := gen_random_uuid();
        
        INSERT INTO public.profiles (
            id,
            full_name,
            email,
            role,
            class_id,
            visual_password_id,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            new_student_id,
            student_name_param,
            lower(replace(student_name_param, ' ', '.')) || '@student.local',
            'student',
            class_record.id,
            visual_password_id_param,
            true,
            NOW(),
            NOW()
        );
    END IF;
    
    -- Generate session token and expiration
    session_token := 'student_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 8);
    expires_at := NOW() + INTERVAL '24 hours';
    
    -- Return success result
    result := json_build_object(
        'success', true,
        'student_id', new_student_id,
        'class_id', class_record.id,
        'session_token', session_token,
        'expires_at', expires_at::text
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Authentication failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users (for student access)
GRANT EXECUTE ON FUNCTION public.authenticate_student_access TO anon;
GRANT EXECUTE ON FUNCTION public.authenticate_student_access TO authenticated;

-- Test the function
SELECT public.authenticate_student_access('6279D4AF', 'Test Student', 'cat');