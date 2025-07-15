-- Create RPC function for students to access published assignments (bypasses RLS)
-- This fixes the issue where students cannot see assignments due to RLS policies

CREATE OR REPLACE FUNCTION public.get_published_assignments_for_class(class_id_param UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  story_id TEXT,
  story_title TEXT,
  class_id UUID,
  due_date TIMESTAMPTZ,
  instructions TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.story_id,
    a.story_title,
    a.class_id,
    a.due_date,
    a.instructions
  FROM public.assignments a
  WHERE a.class_id = class_id_param
    AND a.is_published = true
  ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_published_assignments_for_class TO anon;
GRANT EXECUTE ON FUNCTION public.get_published_assignments_for_class TO authenticated;

-- Test the function with the existing class
SELECT * FROM public.get_published_assignments_for_class('32819745-adee-42df-b2c1-be4fc8bb7c93');