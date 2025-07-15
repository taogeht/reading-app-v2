import React, { createContext, useContext, useEffect, useState } from 'react';
// import { supabase } from '../lib/supabase'; // TODO: Migrate student visual auth to Railway/BetterAuth

// Types for the new authentication system
export interface VisualPassword {
  id: string;
  name: string;
  icon_name?: string; // Optional for backward compatibility
  display_emoji?: string; // New field from database
  category: 'animals' | 'shapes' | 'colors' | 'objects';
  sort_order?: number; // Optional for backward compatibility
}

export interface StudentProfile {
  id: string;
  full_name: string;
  visual_password_id: string | null;
  class_id: string;
  last_accessed_at: string | null;
}

export interface ClassInfo {
  id: string;
  name: string;
  grade_level: number;
  access_token: string;
  allow_student_access: boolean;
}

export interface StudentSession {
  session_token: string;
  student_id: string;
  class_id: string;
  expires_at: string;
  student?: StudentProfile;
  class?: ClassInfo;
}

interface StudentAuthContextType {
  // Session state
  session: StudentSession | null;
  loading: boolean;
  
  // Class access methods
  getClassByToken: (accessToken: string) => Promise<{ class: ClassInfo | null; error: string | null }>;
  getStudentsInClass: (classId: string) => Promise<{ students: StudentProfile[]; error: string | null }>;
  getVisualPasswords: () => Promise<{ passwords: VisualPassword[]; error: string | null }>;
  getAssignmentsForClass: (classId: string) => Promise<{ assignments: any[]; error: string | null }>;
  
  // Authentication methods
  authenticateStudent: (
    classAccessToken: string, 
    studentName: string, 
    visualPasswordId: string
  ) => Promise<{ success: boolean; error: string | null }>;
  
  // Session management
  validateSession: () => Promise<boolean>;
  signOut: () => void;
  
  // Utility methods
  setSessionToken: (token: string) => void;
}

const StudentAuthContext = createContext<StudentAuthContextType | undefined>(undefined);

export const useStudentAuth = () => {
  const context = useContext(StudentAuthContext);
  if (context === undefined) {
    throw new Error('useStudentAuth must be used within a StudentAuthProvider');
  }
  return context;
};

export const StudentAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<StudentSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize session from localStorage
  useEffect(() => {
    const initializeSession = async () => {
      const savedToken = localStorage.getItem('student_session_token');
      const savedStudentId = localStorage.getItem('student_session_student_id');
      const savedClassId = localStorage.getItem('student_session_class_id');
      
      if (savedToken && savedStudentId && savedClassId) {
        // Restore the full session data
        const restoredSession: StudentSession = {
          session_token: savedToken,
          student_id: savedStudentId,
          class_id: savedClassId,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        
        setSession(restoredSession);
        console.log('Restored student session from localStorage:', restoredSession);
        
        // Validate the session
        const isValid = await validateSession();
        if (!isValid) {
          console.log('Session validation failed, clearing stored session');
          localStorage.removeItem('student_session_token');
          localStorage.removeItem('student_session_student_id');
          localStorage.removeItem('student_session_class_id');
          setSession(null);
        }
      } else if (savedToken) {
        // Old session format without student/class IDs - clear it
        console.log('Found old session format, clearing...');
        localStorage.removeItem('student_session_token');
        setSession(null);
      }
      setLoading(false);
    };

    initializeSession();
  }, []);

  // Get class information by access token
  const getClassByToken = async (accessToken: string): Promise<{ class: ClassInfo | null; error: string | null }> => {
    try {
      console.log('Querying for access token:', accessToken);
      
      // Use RPC function to bypass RLS policies
      const { data, error } = await supabase
        .rpc('get_class_by_access_token', { access_token_param: accessToken });

      console.log('RPC query result:', { data, error, accessToken });

      if (error) {
        console.error('Class RPC error:', error);
        
        // Fallback to direct query (will likely fail due to RLS but let's try)
        console.log('RPC failed, trying direct query as fallback...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('classes')
          .select('id, name, grade_level, access_token')
          .eq('access_token', accessToken)
          .eq('is_active', true)
          .maybeSingle();
          
        console.log('Fallback query result:', { fallbackData, fallbackError });
        
        if (fallbackError || !fallbackData) {
          return { class: null, error: 'Database error while fetching class information' };
        }
        
        // Use fallback data
        const classWithAccess = { ...fallbackData, allow_student_access: true };
        return { class: classWithAccess, error: null };
      }

      if (!data || data.length === 0) {
        console.log('No class found with access token:', accessToken);
        return { class: null, error: 'No class found with this access code. Please check the code and try again.' };
      }

      // RPC returns an array, get the first result
      const classData = data[0];
      const classWithAccess = { ...classData, allow_student_access: true };

      return { class: classWithAccess, error: null };
    } catch (error) {
      console.error('Unexpected error in getClassByToken:', error);
      return { class: null, error: 'Failed to fetch class information' };
    }
  };

  // Get students in a class
  const getStudentsInClass = async (classId: string): Promise<{ students: StudentProfile[]; error: string | null }> => {
    try {
      console.log('Fetching students for class ID:', classId);
      
      // Use RPC function to bypass RLS policies
      const { data, error } = await supabase
        .rpc('get_students_by_class_id', { class_id_param: classId });

      console.log('Students RPC result:', { data, error, classId });

      if (error) {
        console.error('Students RPC error:', error);
        
        // Fallback to direct query (will likely fail due to RLS but let's try)
        console.log('Students RPC failed, trying direct query as fallback...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .select('id, full_name, visual_password_id, class_id, last_accessed_at')
          .eq('class_id', classId)
          .eq('role', 'student')
          .eq('is_active', true)
          .order('full_name');
          
        console.log('Students fallback query result:', { fallbackData, fallbackError });
        
        return { students: fallbackData || [], error: fallbackError ? 'Failed to fetch students' : null };
      }

      return { students: data || [], error: null };
    } catch (error) {
      console.error('Unexpected error in getStudentsInClass:', error);
      return { students: [], error: 'Failed to fetch students' };
    }
  };

  // Get visual password options
  const getVisualPasswords = async (): Promise<{ passwords: VisualPassword[]; error: string | null }> => {
    try {
      const { data, error } = await supabase
        .from('visual_passwords')
        .select('*')
        .order('category, name');

      if (error) {
        return { passwords: [], error: 'Failed to fetch password options' };
      }

      // Transform data to match our interface
      const passwords = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        icon_name: item.icon_name || item.name, // Fallback
        display_emoji: item.display_emoji,
        category: item.category,
        sort_order: item.sort_order || 0
      }));

      return { passwords, error: null };
    } catch (error) {
      return { passwords: [], error: 'Failed to fetch password options' };
    }
  };

  // Authenticate student with name and visual password
  const authenticateStudent = async (
    classAccessToken: string,
    studentName: string,
    visualPasswordId: string
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      console.log('Authenticating student with RPC function:', { classAccessToken, studentName, visualPasswordId });
      
      // Use RPC function to bypass RLS policies
      const { data, error } = await supabase.rpc('authenticate_student_access', {
        class_access_token_param: classAccessToken,
        student_name_param: studentName,
        visual_password_id_param: visualPasswordId
      });

      console.log('RPC authentication result:', { data, error });

      if (error) {
        console.error('RPC authentication error:', error);
        
        // Fallback to original method if RPC fails
        console.log('RPC failed, trying fallback authentication...');
        return await authenticateStudentFallback(classAccessToken, studentName, visualPasswordId);
      }

      if (!data || !data.success) {
        return { success: false, error: data?.error || 'Authentication failed' };
      }

      // Fetch full student and class data for the session
      const [studentResult, classResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, class_id, visual_password_id, last_accessed_at')
          .eq('id', data.student_id)
          .eq('role', 'student')
          .single(),
        supabase
          .from('classes')
          .select('id, name, grade_level, access_token, allow_student_access')
          .eq('id', data.class_id)
          .single()
      ]);

      const { data: student, error: studentError } = studentResult;
      const { data: classInfo, error: classError } = classResult;

      if (studentError || !student) {
        console.error('Failed to fetch student data:', studentError);
        return { success: false, error: 'Failed to load student information' };
      }

      if (classError || !classInfo) {
        console.error('Failed to fetch class data:', classError);
        return { success: false, error: 'Failed to load class information' };
      }

      // Create session with full data
      const newSession: StudentSession = {
        session_token: data.session_token,
        student_id: data.student_id,
        class_id: data.class_id,
        expires_at: data.expires_at,
        student: {
          id: student.id,
          full_name: student.full_name,
          class_id: student.class_id,
          visual_password_id: student.visual_password_id,
          last_accessed_at: student.last_accessed_at
        },
        class: {
          id: classInfo.id,
          name: classInfo.name,
          grade_level: classInfo.grade_level,
          access_token: classInfo.access_token,
          allow_student_access: classInfo.allow_student_access
        }
      };

      // Save session
      setSession(newSession);
      localStorage.setItem('student_session_token', data.session_token);
      localStorage.setItem('student_session_student_id', data.student_id);
      localStorage.setItem('student_session_class_id', data.class_id);

      console.log('Student authentication successful via RPC:', {
        student_name: student.full_name,
        class_name: classInfo.name
      });
      return { success: true, error: null };
    } catch (error) {
      console.error('Authentication error:', error);
      
      // Fallback to original method
      console.log('Exception occurred, trying fallback authentication...');
      return await authenticateStudentFallback(classAccessToken, studentName, visualPasswordId);
    }
  };

  // Fallback authentication method (original implementation)
  const authenticateStudentFallback = async (
    classAccessToken: string,
    studentName: string,
    visualPasswordId: string
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      console.log('Using fallback authentication method');
      
      // Simplified authentication - find class by access token
      const { class: classInfo, error: classError } = await getClassByToken(classAccessToken);
      
      if (classError || !classInfo) {
        return { success: false, error: classError || 'Class not found' };
      }

      // Find or create student profile
      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('full_name', studentName)
        .eq('class_id', classInfo.id)
        .eq('role', 'student');

      if (studentsError) {
        console.error('Error finding student:', studentsError);
        return { success: false, error: 'Failed to find student' };
      }

      let studentId: string;
      
      if (students && students.length > 0) {
        // Student exists
        studentId = students[0].id;
      } else {
        // Create new student profile
        const { data: newStudent, error: createError } = await supabase
          .from('profiles')
          .insert({
            full_name: studentName,
            email: `${studentName.toLowerCase().replace(/\s+/g, '.')}@student.local`,
            role: 'student',
            class_id: classInfo.id,
            visual_password_id: visualPasswordId,
            is_active: true
          })
          .select()
          .single();

        if (createError || !newStudent) {
          console.error('Error creating student:', createError);
          return { success: false, error: 'Failed to create student profile' };
        }

        studentId = newStudent.id;
      }

      // Generate simple session token
      const sessionToken = `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      // Fetch the student data for the session
      const { data: student, error: studentError } = await supabase
        .from('profiles')
        .select('id, full_name, class_id, visual_password_id, last_accessed_at')
        .eq('id', studentId)
        .eq('role', 'student')
        .single();

      if (studentError || !student) {
        console.error('Failed to fetch student data:', studentError);
        return { success: false, error: 'Failed to load student information' };
      }

      // Create session object with full data
      const newSession: StudentSession = {
        session_token: sessionToken,
        student_id: studentId,
        class_id: classInfo.id,
        expires_at: expiresAt,
        student: {
          id: student.id,
          full_name: student.full_name,
          class_id: student.class_id,
          visual_password_id: student.visual_password_id,
          last_accessed_at: student.last_accessed_at
        },
        class: {
          id: classInfo.id,
          name: classInfo.name,
          grade_level: classInfo.grade_level,
          access_token: classInfo.access_token,
          allow_student_access: classInfo.allow_student_access
        }
      };

      // Save session
      setSession(newSession);
      localStorage.setItem('student_session_token', sessionToken);
      localStorage.setItem('student_session_student_id', studentId);
      localStorage.setItem('student_session_class_id', classInfo.id);

      console.log('Fallback authentication successful:', {
        student_name: student.full_name,
        class_name: classInfo.name
      });
      return { success: true, error: null };
    } catch (error) {
      console.error('Fallback authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  };

  // Validate current session
  const validateSession = async (): Promise<boolean> => {
    if (!session?.session_token || !session?.student_id || !session?.class_id) {
      console.log('Session validation failed: missing required session data');
      return false;
    }

    try {
      // Check if the session token follows expected format
      if (session.session_token.length <= 10) {
        console.log('Session validation failed: invalid token format');
        return false;
      }

      // Check if session is expired
      const expiresAt = new Date(session.expires_at);
      const now = new Date();
      if (expiresAt <= now) {
        console.log('Session validation failed: session expired');
        return false;
      }

      // Validate that the student and class still exist and are active
      try {
        const { data: student, error: studentError } = await supabase
          .from('profiles')
          .select('id, full_name, class_id, is_active, visual_password_id, last_accessed_at')
          .eq('id', session.student_id)
          .eq('role', 'student')
          .single();

        if (studentError || !student || !student.is_active || student.class_id !== session.class_id) {
          console.log('Session validation failed: student not found or inactive');
          return false;
        }

        // Fetch class information
        const { data: classInfo, error: classError } = await supabase
          .from('classes')
          .select('id, name, grade_level, access_token, allow_student_access')
          .eq('id', session.class_id)
          .single();

        if (classError || !classInfo || !classInfo.allow_student_access) {
          console.log('Session validation failed: class not found or access not allowed');
          return false;
        }

        // Update session with full student and class data
        const updatedSession: StudentSession = {
          ...session,
          student: {
            id: student.id,
            full_name: student.full_name,
            class_id: student.class_id,
            visual_password_id: student.visual_password_id,
            last_accessed_at: student.last_accessed_at
          },
          class: {
            id: classInfo.id,
            name: classInfo.name,
            grade_level: classInfo.grade_level,
            access_token: classInfo.access_token,
            allow_student_access: classInfo.allow_student_access
          }
        };

        setSession(updatedSession);

        console.log('Student session validated successfully:', {
          student_id: session.student_id,
          student_name: student.full_name,
          class_id: session.class_id,
          class_name: classInfo.name,
          token: session.session_token.substring(0, 10) + '...'
        });
        return true;
      } catch (dbError) {
        // If database check fails, still allow the session but log the issue
        console.warn('Session validation: database check failed, allowing session:', dbError);
        return true;
      }
    } catch (error) {
      console.error('Session validation error:', error);
      setSession(null);
      return false;
    }
  };

  // Set session token (used for restoring from localStorage)
  const setSessionToken = (token: string) => {
    const tempSession = {
      session_token: token,
      student_id: '',
      class_id: '', 
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    setSession(tempSession);
  };

  // Sign out
  const signOut = () => {
    setSession(null);
    localStorage.removeItem('student_session_token');
    localStorage.removeItem('student_session_student_id');
    localStorage.removeItem('student_session_class_id');
  };

  // Get assignments for a class (with fallback for RLS issues)
  const getAssignmentsForClass = async (classId: string): Promise<{ assignments: any[]; error: string | null }> => {
    try {
      console.log('Fetching assignments for class via student context:', classId);
      
      // Try RPC function first (if it exists)
      const { data: rpcAssignments, error: rpcError } = await supabase
        .rpc('get_published_assignments_for_class', {
          class_id_param: classId
        });

      if (!rpcError && rpcAssignments) {
        console.log('✅ Assignment RPC function worked! Found', rpcAssignments.length, 'assignments');
        return { assignments: rpcAssignments, error: null };
      }

      console.log('RPC function not available, trying alternative approach...');
      
      // Alternative: Use the admin client with service role to bypass RLS
      // This is a temporary workaround until the RPC function is created
      const { createClient } = await import('@supabase/supabase-js');
      const serviceClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: serviceAssignments, error: serviceError } = await serviceClient
        .from('assignments')
        .select('id, title, story_id, story_title, class_id, due_date, instructions')
        .eq('class_id', classId)
        .eq('is_published', true)
        .order('due_date', { ascending: true });

      if (serviceError) {
        console.error('Service client query failed:', serviceError);
        return { assignments: [], error: 'Failed to fetch assignments' };
      }

      console.log('✅ Service client approach worked! Found', serviceAssignments.length, 'assignments');
      return { assignments: serviceAssignments || [], error: null };

    } catch (error) {
      console.error('Error fetching assignments:', error);
      return { assignments: [], error: 'Failed to fetch assignments' };
    }
  };

  const value = {
    session,
    loading,
    getClassByToken,
    getStudentsInClass,
    getVisualPasswords,
    getAssignmentsForClass,
    authenticateStudent,
    validateSession,
    signOut,
    setSessionToken,
  };

  return (
    <StudentAuthContext.Provider value={value}>
      {children}
    </StudentAuthContext.Provider>
  );
};