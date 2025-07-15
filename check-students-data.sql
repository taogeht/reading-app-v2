-- Check students in Ms. Vickies Class
SELECT 
    id,
    full_name,
    email,
    role,
    class_id,
    visual_password_id,
    is_active
FROM profiles 
WHERE class_id = '32819745-adee-42df-b2c1-be4fc8bb7c93'
  AND role = 'student';

-- Check if visual_password_id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'visual_password_id';

-- Check all students in all classes
SELECT 
    p.full_name,
    p.role,
    c.name as class_name,
    p.is_active,
    p.visual_password_id
FROM profiles p
LEFT JOIN classes c ON p.class_id = c.id
WHERE p.role = 'student'
ORDER BY c.name, p.full_name;