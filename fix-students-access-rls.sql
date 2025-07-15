-- Create a public function to get students by class ID (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_students_by_class_id(class_id_param UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    visual_password_id TEXT,
    class_id UUID,
    last_accessed_at TIMESTAMPTZ
) AS $$
BEGIN
    -- This function bypasses RLS by running with elevated privileges
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.visual_password_id,
        p.class_id,
        p.last_accessed_at
    FROM public.profiles p
    WHERE p.class_id = class_id_param
      AND p.role = 'student'
      AND p.is_active = true
    ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users (for student access)
GRANT EXECUTE ON FUNCTION public.get_students_by_class_id TO anon;
GRANT EXECUTE ON FUNCTION public.get_students_by_class_id TO authenticated;

-- Test the function with the class ID from Ms. Vickies Class
SELECT * FROM public.get_students_by_class_id('32819745-adee-42df-b2c1-be4fc8bb7c93');