-- Check if the access token exists in classes table
SELECT 
    id,
    name,
    grade_level,
    access_token,
    is_active,
    teacher_id
FROM classes 
WHERE access_token = '6279D4AF';

-- Check all classes and their access tokens
SELECT 
    id,
    name,
    access_token,
    is_active
FROM classes 
WHERE is_active = true
ORDER BY name;