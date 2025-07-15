import React, { createContext, useContext, useEffect, useState } from 'react';
// TODO: Migrate student visual auth to Railway/BetterAuth

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

  // Mock implementations for Railway migration
  const getClassByToken = async (accessToken: string): Promise<{ class: ClassInfo | null; error: string | null }> => {
    console.warn('getClassByToken not implemented - using mock');
    return { class: null, error: 'Class lookup not implemented' };
  };

  const getStudentsInClass = async (classId: string): Promise<{ students: StudentProfile[]; error: string | null }> => {
    console.warn('getStudentsInClass not implemented - using mock');
    return { students: [], error: null };
  };

  const getVisualPasswords = async (): Promise<{ passwords: VisualPassword[]; error: string | null }> => {
    console.warn('getVisualPasswords not implemented - using mock');
    
    // Return mock visual passwords for basic functionality
    const mockPasswords: VisualPassword[] = [
      { id: '1', name: 'Cat', display_emoji: '🐱', category: 'animals', sort_order: 1 },
      { id: '2', name: 'Dog', display_emoji: '🐶', category: 'animals', sort_order: 2 },
      { id: '3', name: 'Star', display_emoji: '⭐', category: 'shapes', sort_order: 3 },
      { id: '4', name: 'Heart', display_emoji: '❤️', category: 'shapes', sort_order: 4 },
      { id: '5', name: 'Apple', display_emoji: '🍎', category: 'objects', sort_order: 5 },
      { id: '6', name: 'Ball', display_emoji: '⚽', category: 'objects', sort_order: 6 },
    ];
    
    return { passwords: mockPasswords, error: null };
  };

  const authenticateStudent = async (
    classAccessToken: string,
    studentName: string,
    visualPasswordId: string
  ): Promise<{ success: boolean; error: string | null }> => {
    console.warn('authenticateStudent not implemented - using mock');
    return { success: false, error: 'Student authentication not implemented' };
  };

  const validateSession = async (): Promise<boolean> => {
    console.warn('validateSession not implemented - using mock');
    if (!session?.session_token || !session?.student_id || !session?.class_id) {
      return false;
    }

    // Check if session is expired
    const expiresAt = new Date(session.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      return false;
    }

    return true;
  };

  const setSessionToken = (token: string) => {
    const tempSession = {
      session_token: token,
      student_id: '',
      class_id: '', 
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    setSession(tempSession);
  };

  const signOut = () => {
    setSession(null);
    localStorage.removeItem('student_session_token');
    localStorage.removeItem('student_session_student_id');
    localStorage.removeItem('student_session_class_id');
  };

  const getAssignmentsForClass = async (classId: string): Promise<{ assignments: any[]; error: string | null }> => {
    console.warn('getAssignmentsForClass not implemented - using mock');
    return { assignments: [], error: null };
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