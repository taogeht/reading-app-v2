-- Create a public function to get class by access token (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_class_by_access_token(access_token_param TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    grade_level INTEGER,
    access_token TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    -- This function bypasses RLS by running with elevated privileges
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.grade_level,
        c.access_token,
        c.is_active
    FROM public.classes c
    WHERE c.access_token = access_token_param
      AND c.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users (for student access)
GRANT EXECUTE ON FUNCTION public.get_class_by_access_token TO anon;
GRANT EXECUTE ON FUNCTION public.get_class_by_access_token TO authenticated;

-- Test the function
SELECT * FROM public.get_class_by_access_token('6279D4AF');