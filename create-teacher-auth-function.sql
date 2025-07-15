-- Create a public function for teacher authentication
-- This bypasses RLS restrictions for username lookup

CREATE OR REPLACE FUNCTION authenticate_teacher_by_username(
    p_username VARCHAR(50)
)
RETURNS JSON AS $$
DECLARE
    teacher_record RECORD;
    result JSON;
BEGIN
    -- Find teacher by username
    SELECT id, email, full_name, role, username, is_active
    INTO teacher_record
    FROM profiles
    WHERE username = p_username 
      AND role = 'teacher' 
      AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Teacher not found'
        );
    END IF;
    
    -- Return teacher data for frontend authentication
    result := json_build_object(
        'success', true,
        'teacher', json_build_object(
            'id', teacher_record.id,
            'email', teacher_record.email,
            'full_name', teacher_record.full_name,
            'role', teacher_record.role,
            'username', teacher_record.username
        )
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;