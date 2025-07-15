-- Test Data for Reading Practice Platform
-- Run this AFTER running 001_initial_schema.sql to add sample data

-- =============================================================================
-- SAMPLE TEST DATA (OPTIONAL)
-- =============================================================================

-- Note: You can create test users through the Supabase Auth interface
-- or your app's signup process. This will automatically create profiles.

-- Sample classes (replace teacher_id with actual UUID from your profiles table)
-- You can get teacher IDs by running: SELECT id, email FROM profiles WHERE role = 'teacher';

/*
-- Example: Create a sample class (uncomment and replace with real teacher ID)
INSERT INTO public.classes (name, grade_level, teacher_id, school_year, description) VALUES
('Ms. Johnson''s 2nd Grade', 2, 'replace-with-teacher-uuid', '2024-2025', 'Second grade reading class'),
('Mr. Smith''s 3rd Grade', 3, 'replace-with-teacher-uuid', '2024-2025', 'Advanced third grade readers');

-- Example: Create sample assignments (replace class_id and teacher_id with real UUIDs)
INSERT INTO public.assignments (
    title, 
    description, 
    story_id, 
    story_title, 
    class_id, 
    teacher_id, 
    instructions,
    is_published
) VALUES
(
    'Practice Reading: The Little Red Hen',
    'Read the story clearly and at a comfortable pace.',
    'story-001',
    'The Little Red Hen',
    'replace-with-class-uuid',
    'replace-with-teacher-uuid',
    'Take your time and focus on pronunciation. You can try up to 3 times.',
    true
),
(
    'Character Education: The Boy Who Cried Wolf',
    'Focus on the emotional changes in the story.',
    'story-002', 
    'The Boy Who Cried Wolf',
    'replace-with-class-uuid',
    'replace-with-teacher-uuid',
    'Pay attention to the different characters and their feelings.',
    true
);
*/

-- =============================================================================
-- HELPFUL QUERIES FOR TESTING
-- =============================================================================

-- Check if schema was created successfully
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('profiles', 'classes', 'assignments', 'recordings');

-- View all users and their roles
-- SELECT id, email, full_name, role, class_id FROM profiles ORDER BY role, full_name;

-- View all classes with teacher info
-- SELECT c.name, c.grade_level, p.full_name as teacher_name, p.email as teacher_email 
-- FROM classes c 
-- JOIN profiles p ON c.teacher_id = p.id 
-- ORDER BY c.grade_level, c.name;

-- View all assignments with class info
-- SELECT a.title, a.story_title, c.name as class_name, c.grade_level
-- FROM assignments a
-- JOIN classes c ON a.class_id = c.id
-- WHERE a.is_published = true
-- ORDER BY c.grade_level, a.title;

-- View recordings with student and assignment info
-- SELECT r.status, r.accuracy_score, r.submitted_at,
--        s.full_name as student_name, a.title as assignment_title
-- FROM recordings r
-- JOIN profiles s ON r.student_id = s.id  
-- JOIN assignments a ON r.assignment_id = a.id
-- ORDER BY r.submitted_at DESC;