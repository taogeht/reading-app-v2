-- Storage policies for student-recordings bucket

-- Policy: Students can upload to their own folder
CREATE POLICY "Students can upload recordings to their folder" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'student-recordings' 
    AND auth.uid() IN (
        SELECT id FROM profiles 
        WHERE role = 'student'
    )
    AND name LIKE 'recordings/%/' || auth.uid()::text || '/%'
);

-- Policy: Students can view their own recordings
CREATE POLICY "Students can view their own recordings" 
ON storage.objects FOR SELECT 
USING (
    bucket_id = 'student-recordings' 
    AND (
        auth.uid() IN (
            SELECT id FROM profiles 
            WHERE role = 'student'
        )
        AND name LIKE 'recordings/%/' || auth.uid()::text || '/%'
    )
);

-- Policy: Teachers can view recordings from their classes
CREATE POLICY "Teachers can view class recordings" 
ON storage.objects FOR SELECT 
USING (
    bucket_id = 'student-recordings' 
    AND (
        auth.uid() IN (
            SELECT teacher_id FROM classes 
            WHERE id::text = split_part(name, '/', 2)
        )
        OR
        auth.uid() IN (
            SELECT id FROM profiles 
            WHERE role = 'admin'
        )
    )
);

-- Policy: Teachers can delete recordings from their classes
CREATE POLICY "Teachers can delete class recordings" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'student-recordings' 
    AND (
        auth.uid() IN (
            SELECT teacher_id FROM classes 
            WHERE id::text = split_part(name, '/', 2)
        )
        OR
        auth.uid() IN (
            SELECT id FROM profiles 
            WHERE role = 'admin'
        )
    )
);

-- Policy: Admins have full access
CREATE POLICY "Admins have full access to recordings storage" 
ON storage.objects FOR ALL 
USING (
    bucket_id = 'student-recordings' 
    AND auth.uid() IN (
        SELECT id FROM profiles 
        WHERE role = 'admin'
    )
);

COMMENT ON POLICY "Students can upload recordings to their folder" ON storage.objects IS 'Students can only upload to their own folder within their class';
COMMENT ON POLICY "Teachers can view class recordings" ON storage.objects IS 'Teachers can view recordings from classes they teach';