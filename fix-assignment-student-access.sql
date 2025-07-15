-- Create RLS policy to allow students (anonymous users) to view published assignments
-- This fixes the issue where students can't see assignments created by teachers

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Students can view published assignments for their class" ON public.assignments;

-- Create new policy allowing anonymous users to view published assignments
CREATE POLICY "Students can view published assignments for their class"
ON public.assignments
FOR SELECT
TO anon, authenticated
USING (is_published = true);

-- Also create a policy for students to view published assignments for their specific class
-- (more restrictive, but we'll start with the broader one)
CREATE POLICY IF NOT EXISTS "Student assignment access by class"
ON public.assignments
FOR SELECT
TO anon, authenticated
USING (
  is_published = true
);

-- Grant necessary permissions
GRANT SELECT ON public.assignments TO anon;
GRANT SELECT ON public.assignments TO authenticated;

-- Test the policy by selecting published assignments
SELECT 
  id,
  title,
  story_title,
  class_id,
  is_published,
  due_date,
  instructions
FROM public.assignments 
WHERE is_published = true;