-- Updated Authentication Schema for Child-Friendly Access
-- This modifies the existing schema to support the new authentication flow

-- =============================================================================
-- UPDATE PROFILES TABLE FOR NEW AUTH MODEL
-- =============================================================================

-- Add visual password and access token fields for students
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS visual_password_id TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

-- Add class access tokens for QR code/link access
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
ADD COLUMN IF NOT EXISTS allow_student_access BOOLEAN DEFAULT true;

-- =============================================================================
-- VISUAL PASSWORD OPTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.visual_passwords (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_name TEXT NOT NULL, -- Lucide icon name
    category TEXT NOT NULL, -- 'animals', 'shapes', 'colors', 'objects'
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- CLASS ACCESS SESSIONS (FOR STUDENT ACCESS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.class_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- POPULATE VISUAL PASSWORD OPTIONS
-- =============================================================================

INSERT INTO public.visual_passwords (id, name, icon_name, category, sort_order) VALUES
-- Animals
('cat', 'Cat', 'Cat', 'animals', 1),
('dog', 'Dog', 'Dog', 'animals', 2),
('rabbit', 'Rabbit', 'Rabbit', 'animals', 3),
('fish', 'Fish', 'Fish', 'animals', 4),
('bird', 'Bird', 'Bird', 'animals', 5),
('turtle', 'Turtle', 'Turtle', 'animals', 6),

-- Shapes
('circle', 'Circle', 'Circle', 'shapes', 7),
('square', 'Square', 'Square', 'shapes', 8),
('triangle', 'Triangle', 'Triangle', 'shapes', 9),
('star', 'Star', 'Star', 'shapes', 10),
('heart', 'Heart', 'Heart', 'shapes', 11),
('diamond', 'Diamond', 'Diamond', 'shapes', 12),

-- Objects
('car', 'Car', 'Car', 'objects', 13),
('house', 'House', 'Home', 'objects', 14),
('tree', 'Tree', 'Tree', 'objects', 15),
('flower', 'Flower', 'Flower', 'objects', 16),
('sun', 'Sun', 'Sun', 'objects', 17),
('moon', 'Moon', 'Moon', 'objects', 18),

-- Colors (using colored circles)
('red', 'Red', 'Circle', 'colors', 19),
('blue', 'Blue', 'Circle', 'colors', 20),
('green', 'Green', 'Circle', 'colors', 21),
('yellow', 'Yellow', 'Circle', 'colors', 22),
('purple', 'Purple', 'Circle', 'colors', 23),
('orange', 'Orange', 'Circle', 'colors', 24)

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- GENERATE ACCESS TOKENS FOR EXISTING CLASSES
-- =============================================================================

-- Function to generate random access tokens
CREATE OR REPLACE FUNCTION generate_class_access_token() RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(
        SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8) || 
        SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8)
    );
END;
$$ LANGUAGE plpgsql;

-- Update existing classes with access tokens
UPDATE public.classes 
SET access_token = generate_class_access_token() 
WHERE access_token IS NULL;

-- =============================================================================
-- UPDATED ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Drop old policies that relied on auth.uid()
DROP POLICY IF EXISTS "Students can view their assigned class" ON public.classes;
DROP POLICY IF EXISTS "Students can view assignments for their class" ON public.assignments;
DROP POLICY IF EXISTS "Students can manage their own recordings" ON public.recordings;

-- New policies for session-based access

-- Students can view their class via session token (no auth.uid() required)
CREATE POLICY "Students can view class via session" ON public.classes
    FOR SELECT USING (
        id IN (
            SELECT class_id FROM public.class_sessions 
            WHERE session_token = current_setting('app.current_session_token', true)
            AND expires_at > now()
        )
    );

-- Students can view assignments for their class via session
CREATE POLICY "Students can view assignments via session" ON public.assignments
    FOR SELECT USING (
        is_published = true AND
        class_id IN (
            SELECT class_id FROM public.class_sessions 
            WHERE session_token = current_setting('app.current_session_token', true)
            AND expires_at > now()
        )
    );

-- Students can manage recordings via session
CREATE POLICY "Students can manage recordings via session" ON public.recordings
    FOR ALL USING (
        student_id IN (
            SELECT student_id FROM public.class_sessions 
            WHERE session_token = current_setting('app.current_session_token', true)
            AND expires_at > now()
        )
    );

-- =============================================================================
-- INDEXES FOR NEW TABLES
-- =============================================================================

CREATE INDEX IF NOT EXISTS visual_passwords_category_idx ON public.visual_passwords(category);
CREATE INDEX IF NOT EXISTS visual_passwords_active_idx ON public.visual_passwords(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS class_sessions_token_idx ON public.class_sessions(session_token);
CREATE INDEX IF NOT EXISTS class_sessions_class_id_idx ON public.class_sessions(class_id);
CREATE INDEX IF NOT EXISTS class_sessions_student_id_idx ON public.class_sessions(student_id);
CREATE INDEX IF NOT EXISTS class_sessions_expires_idx ON public.class_sessions(expires_at);

CREATE INDEX IF NOT EXISTS classes_access_token_idx ON public.classes(access_token);
CREATE INDEX IF NOT EXISTS profiles_visual_password_idx ON public.profiles(visual_password_id);

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Function to create a student session
CREATE OR REPLACE FUNCTION public.create_student_session(
    p_class_id UUID,
    p_student_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_session_token TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Generate session token
    v_session_token := LOWER(
        SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 16) ||
        SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 16)
    );
    
    -- Session expires in 8 hours (school day)
    v_expires_at := now() + INTERVAL '8 hours';
    
    -- Clean up expired sessions
    DELETE FROM public.class_sessions WHERE expires_at < now();
    
    -- Delete existing session for this student in this class
    DELETE FROM public.class_sessions 
    WHERE class_id = p_class_id AND student_id = p_student_id;
    
    -- Create new session
    INSERT INTO public.class_sessions (class_id, student_id, session_token, expires_at)
    VALUES (p_class_id, p_student_id, v_session_token, v_expires_at);
    
    -- Update student's last accessed time
    UPDATE public.profiles 
    SET last_accessed_at = now() 
    WHERE id = p_student_id;
    
    RETURN v_session_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate student access
CREATE OR REPLACE FUNCTION public.validate_student_access(
    p_class_access_token TEXT,
    p_student_name TEXT,
    p_visual_password_id TEXT
) RETURNS JSON AS $$
DECLARE
    v_class_id UUID;
    v_student_id UUID;
    v_session_token TEXT;
    v_result JSON;
BEGIN
    -- Find class by access token
    SELECT id INTO v_class_id 
    FROM public.classes 
    WHERE access_token = p_class_access_token 
    AND allow_student_access = true
    AND is_active = true;
    
    IF v_class_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid class access code');
    END IF;
    
    -- Find student by name and visual password in this class
    SELECT id INTO v_student_id
    FROM public.profiles
    WHERE LOWER(full_name) = LOWER(p_student_name)
    AND visual_password_id = p_visual_password_id
    AND class_id = v_class_id
    AND role = 'student'
    AND is_active = true;
    
    IF v_student_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid name or password');
    END IF;
    
    -- Create session
    v_session_token := public.create_student_session(v_class_id, v_student_id);
    
    -- Return success with session info
    v_result := json_build_object(
        'success', true,
        'session_token', v_session_token,
        'student_id', v_student_id,
        'class_id', v_class_id,
        'expires_at', (now() + INTERVAL '8 hours')::TEXT
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- CLEANUP FUNCTION
-- =============================================================================

-- Function to clean up expired sessions (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions() RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.class_sessions WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;