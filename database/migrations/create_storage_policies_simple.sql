-- Simple storage policies for student-recordings bucket
-- Run this in Supabase Dashboard > Storage > Policies

-- First, let's create a basic policy that allows authenticated users to upload
-- You can refine these later in the Supabase dashboard

-- Policy 1: Allow authenticated users to upload recordings
INSERT INTO storage.policies (id, bucket_id, policy_name, policy_role, policy_cmd, policy_definition)
VALUES (
  'student-recordings-upload',
  'student-recordings',
  'Allow authenticated uploads',
  'authenticated',
  'INSERT',
  'auth.uid() IS NOT NULL'
) ON CONFLICT (id) DO NOTHING;

-- Policy 2: Allow authenticated users to read recordings
INSERT INTO storage.policies (id, bucket_id, policy_name, policy_role, policy_cmd, policy_definition)
VALUES (
  'student-recordings-read',
  'student-recordings', 
  'Allow authenticated reads',
  'authenticated',
  'SELECT',
  'auth.uid() IS NOT NULL'
) ON CONFLICT (id) DO NOTHING;