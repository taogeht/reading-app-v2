import { supabase, supabaseAdmin } from '../lib/supabase';
import { UserProfile } from '../contexts/AuthContext';

// =============================================================================
// ADMIN HELPER FUNCTIONS
// =============================================================================

// Check if current user is admin using secure database function
export const checkIsAdmin = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Check if current user is teacher or admin
export const checkIsTeacherOrAdmin = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('is_teacher_or_admin');
    if (error) {
      console.error('Error checking teacher/admin status:', error);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error('Error checking teacher/admin status:', error);
    return false;
  }
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Class {
  id: string;
  name: string;
  grade_level: number;
  teacher_id: string;
  school_year?: string;
  description?: string;
  is_active: boolean;
  max_students?: number; // Class capacity limit
  access_token?: string; // For student access
  created_at: string;
  updated_at: string;
  teacher?: UserProfile; // Populated via join
  student_count?: number; // Computed field
}

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  story_id: string;
  story_title: string;
  class_id: string;
  teacher_id: string;
  due_date?: string;
  instructions?: string;
  max_attempts: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  class?: Class; // Populated via join
  recording_count?: number; // Computed field
}

export interface Recording {
  id: string;
  student_id: string;
  assignment_id: string;
  attempt_number: number;
  audio_url: string;
  audio_filename: string;
  audio_size_bytes?: number;
  audio_duration_seconds?: number;
  transcript?: string;
  feedback_data?: any; // FeedbackData JSON
  accuracy_score?: number;
  reading_pace?: 'too-fast' | 'just-right' | 'too-slow';
  word_count?: number;
  correct_words?: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  processing_started_at?: string;
  processing_completed_at?: string;
  error_message?: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  student?: UserProfile; // Populated via join
  assignment?: Assignment; // Populated via join
}

// =============================================================================
// PROFILE SERVICES
// =============================================================================

export const profileService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    return { error };
  },

  async getStudentsByClass(classId: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('class_id', classId)
      .eq('role', 'student')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      console.error('Error fetching students:', error);
      return [];
    }

    return data || [];
  },

  async getTeachers(): Promise<UserProfile[]> {
    // SECURITY: Using regular client only - admin operations should use backend API
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      console.error('Error fetching teachers:', error);
      return [];
    }

    return data || [];
  },

  async getAllStudents(): Promise<UserProfile[]> {
    // SECURITY: Using regular client only - admin operations should use backend API
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      console.error('Error fetching all students:', error);
      return [];
    }

    return data || [];
  },

  // Teacher CRUD operations
  async createTeacher(teacherData: {
    full_name: string;
    email: string;
    password: string;
  }): Promise<void> {
    // First create the auth user with role metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: teacherData.email,
      password: teacherData.password,
      options: {
        data: {
          role: 'teacher',
          full_name: teacherData.full_name
        }
      }
    });

    if (authError) {
      // Provide more helpful error messages for common issues
      if (authError.message.includes('invalid') && authError.message.includes('email')) {
        throw new Error(`Invalid email format. Please use a valid email like "teacher@example.com" or "user@school.edu"`);
      }
      throw new Error(`Failed to create teacher account: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('Failed to create teacher account');
    }

    // Use the simple function to create the profile
    const { error: functionError } = await supabase.rpc('create_teacher_profile_simple', {
      teacher_id: authData.user.id,
      teacher_email: teacherData.email,
      teacher_name: teacherData.full_name
    });

    if (functionError) {
      throw new Error(`Failed to create teacher profile: ${functionError.message}`);
    }
  },

  // Create teacher using secure database function (admin role required)
  async createTeacherWithUsername(teacherData: {
    full_name: string;
    username: string;
  }): Promise<{ username: string; password: string; user_id: string }> {
    // Use secure database function that validates admin role
    const { data, error } = await supabase.rpc('admin_create_teacher_with_username', {
      p_username: teacherData.username,
      p_full_name: teacherData.full_name,
      p_email: null // Will generate fake email
    });

    if (error) {
      throw new Error(`Failed to create teacher: ${error.message}`);
    }

    return {
      username: data.username,
      password: data.password,
      user_id: data.user_id
    };
  },

  // Create teacher with email using secure database function (admin role required)
  async createTeacherWithEmail(teacherData: {
    full_name: string;
    email: string;
  }): Promise<{ email: string; password: string; user_id: string }> {
    // Use email prefix as username
    const username = teacherData.email.split('@')[0];
    
    // Use secure database function that validates admin role
    const { data, error } = await supabase.rpc('admin_create_teacher_with_username', {
      p_username: username,
      p_full_name: teacherData.full_name,
      p_email: teacherData.email
    });

    if (error) {
      throw new Error(`Failed to create teacher: ${error.message}`);
    }

    return {
      email: data.email,
      password: data.password,
      user_id: data.user_id
    };
  },

  async updateTeacher(teacherId: string, updates: {
    full_name?: string;
    email?: string;
    username?: string;
    is_active?: boolean;
  }): Promise<void> {
    // Check admin permissions
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      throw new Error('Admin access required to update teachers');
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', teacherId);

    if (error) {
      throw new Error(`Failed to update teacher: ${error.message}`);
    }
  },

  async deleteTeacher(teacherId: string): Promise<void> {
    // Check admin permissions
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      throw new Error('Admin access required to delete teachers');
    }

    // Soft delete by deactivating
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', teacherId);

    if (error) {
      throw new Error(`Failed to delete teacher: ${error.message}`);
    }
  },

  async checkTeacherAuthStatus(teacherId: string): Promise<{ hasAuthUser: boolean; profileExists: boolean; }> {
    try {
      // SECURITY: Using regular client only - admin operations should use backend API
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', teacherId)
        .eq('role', 'teacher')
        .single();

      if (profileError || !profile) {
        return { hasAuthUser: false, profileExists: false };
      }

      // SECURITY: Admin auth checking disabled - should use backend API
      console.log(`✅ Profile exists for ${teacherId}, assuming auth user exists`);
      return { hasAuthUser: true, profileExists: true };
    } catch (error) {
      console.error('Error checking teacher auth status:', error);
      return { hasAuthUser: false, profileExists: false };
    }
  },

  // Reset teacher password (admin only) using secure database function
  async resetTeacherPassword(teacherId: string): Promise<{ username: string; password: string; }> {
    // Check admin permissions
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      throw new Error('Admin access required to reset passwords');
    }

    // First check if this is an orphaned profile
    const authStatus = await this.checkTeacherAuthStatus(teacherId);
    
    if (!authStatus.profileExists) {
      throw new Error('Teacher profile not found');
    }

    // Get the teacher profile to get username
    const { data: teacher, error: fetchError } = await supabase
      .from('profiles')
      .select('email, full_name, username')
      .eq('id', teacherId)
      .eq('role', 'teacher')
      .single();

    if (fetchError || !teacher) {
      throw new Error('Teacher not found');
    }

    if (!teacher.username) {
      throw new Error('Teacher has no username set');
    }

    // Generate new password using secure database function
    const { data: newPassword, error: passwordError } = await supabase.rpc('generate_secure_password', { length: 12 });

    if (passwordError) {
      throw new Error(`Failed to generate password: ${passwordError.message}`);
    }

    // Note: Actual password update in auth system would need backend API
    // For now, return the generated password for manual admin update
    return {
      username: teacher.username,
      password: newPassword
    };
  },

  // Repair orphaned teacher profile (admin only) 
  async repairOrphanedTeacherProfile(teacherId: string): Promise<{ username: string; password: string; newUserId: string; }> {
    // Check admin permissions
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      throw new Error('Admin access required to repair accounts');
    }

    // Get the orphaned profile
    const { data: teacher, error: fetchError } = await supabase
      .from('profiles')
      .select('email, full_name, username')
      .eq('id', teacherId)
      .eq('role', 'teacher')
      .single();

    if (fetchError || !teacher) {
      throw new Error('Teacher profile not found');
    }

    // Generate a username from email if not set
    const username = teacher.username || teacher.email.split('@')[0];
    
    if (!username) {
      throw new Error('Cannot determine username for teacher');
    }

    // Generate secure password using database function
    const { data: newPassword, error: passwordError } = await supabase.rpc('generate_secure_password', { length: 12 });

    if (passwordError) {
      throw new Error(`Failed to generate password: ${passwordError.message}`);
    }

    console.log(`🔧 Repairing orphaned profile for ${username}...`);

    // For now, just update the username in the existing profile
    // Full auth user creation would need backend API
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        username: username,
        updated_at: new Date().toISOString()
      })
      .eq('id', teacherId);

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    console.log(`✅ Updated profile username for ${username}`);

    return {
      username: username,
      password: newPassword,
      newUserId: teacherId // Same ID since we're just updating
    };
  },

  // Student CRUD operations
  async createStudent(studentData: {
    full_name: string;
    email: string;
    class_id: string;
    visual_password_id?: string;
  }): Promise<void> {
    // Use the simple function to create student profile (no foreign key constraints)
    const { error } = await supabase.rpc('create_student_profile_simple', {
      student_email: studentData.email,
      student_name: studentData.full_name,
      student_class_id: studentData.class_id,
      visual_password_id: studentData.visual_password_id
    });

    if (error) {
      throw new Error(`Failed to create student: ${error.message}`);
    }
  },

  async updateStudent(studentId: string, updates: {
    full_name?: string;
    email?: string;
    class_id?: string;
    visual_password_id?: string;
    is_active?: boolean;
  }): Promise<void> {
    // Check admin or teacher permissions
    const isAuthorized = await checkIsTeacherOrAdmin();
    if (!isAuthorized) {
      throw new Error('Teacher or admin access required to update students');
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', studentId);

    if (error) {
      throw new Error(`Failed to update student: ${error.message}`);
    }
  },

  async deleteStudent(studentId: string): Promise<void> {
    // Check admin or teacher permissions
    const isAuthorized = await checkIsTeacherOrAdmin();
    if (!isAuthorized) {
      throw new Error('Teacher or admin access required to delete students');
    }

    // Soft delete by deactivating
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', studentId);

    if (error) {
      throw new Error(`Failed to delete student: ${error.message}`);
    }
  },

  // Get all profiles for admin dashboard
  async getAllProfiles(): Promise<UserProfile[]> {
    // SECURITY: Using regular client only - admin operations should use backend API
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('role', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching all profiles:', error);
      return [];
    }

    return data || [];
  },
};

// =============================================================================
// CLASS SERVICES
// =============================================================================

export const classService = {
  async getClasses(): Promise<Class[]> {
    // SECURITY: Using regular client only - admin operations should use backend API
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        teacher:profiles!teacher_id(*)
      `)
      .eq('is_active', true)
      .order('grade_level', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching classes:', error);
      return [];
    }

    // Get student counts for each class using RPC function (bypasses RLS issues)
    const classesWithCounts = await Promise.all(
      (data || []).map(async (classItem) => {
        const { data: count, error } = await supabase
          .rpc('count_students_in_class', { p_class_id: classItem.id });

        if (error) {
          console.error('Error counting students for class:', classItem.id, error);
        }

        return {
          ...classItem,
          student_count: count || 0,
        };
      })
    );

    return classesWithCounts;
  },

  async getClassesFallback(): Promise<Class[]> {
    // Fallback to direct query
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        teacher:profiles!teacher_id(*)
      `)
      .eq('is_active', true)
      .order('grade_level', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching classes:', error);
      return [];
    }

    // Get student counts separately using RPC function (bypasses RLS issues)
    const classesWithCounts = await Promise.all(
      (data || []).map(async (classItem) => {
        const { data: count, error } = await supabase
          .rpc('count_students_in_class', { p_class_id: classItem.id });

        if (error) {
          console.error('Error counting students for class:', classItem.id, error);
        }

        return {
          ...classItem,
          student_count: count || 0,
        };
      })
    );

    return classesWithCounts;
  },

  async getClassesByTeacher(teacherId: string): Promise<Class[]> {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        profiles!class_id(count)
      `)
      .eq('teacher_id', teacherId)
      .eq('is_active', true)
      .order('grade_level', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching teacher classes:', error);
      return [];
    }

    return data || [];
  },

  async getClass(classId: string): Promise<Class | null> {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        teacher:profiles!teacher_id(*)
      `)
      .eq('id', classId)
      .single();

    if (error) {
      console.error('Error fetching class:', error);
      return null;
    }

    return data;
  },

  async createClass(classData: {
    name: string;
    grade_level: number;
    teacher_id: string;
    school_year?: string;
    description?: string;
    max_students?: number;
  }): Promise<{ data: Class | null; error: Error | null }> {
    const { data, error } = await supabase.rpc('admin_create_class', {
      class_name: classData.name,
      class_grade_level: classData.grade_level,
      class_teacher_id: classData.teacher_id,
      class_school_year: classData.school_year,
      class_description: classData.description,
      class_max_students: classData.max_students,
    });

    if (error) {
      return { data: null, error };
    }

    // The function returns the new class ID, so we need to fetch the full class data
    const newClass = await this.getClass(data);
    return { data: newClass, error: null };
  },

  async updateClass(classId: string, updates: Partial<Class>): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('classes')
      .update(updates)
      .eq('id', classId);

    return { error };
  },

  async deleteClass(classId: string): Promise<{ error: Error | null }> {
    // Soft delete - mark as inactive
    const { error } = await supabase
      .from('classes')
      .update({ is_active: false })
      .eq('id', classId);

    return { error };
  },
};

// =============================================================================
// ASSIGNMENT SERVICES
// =============================================================================

export const assignmentService = {
  async getAssignments(): Promise<Assignment[]> {
    // SECURITY: Using regular client only - admin operations should use backend API
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        class:classes(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching assignments:', error);
      return [];
    }

    return data || [];
  },

  async getAssignmentsByClass(classId: string): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('class_id', classId)
      .eq('is_published', true)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching class assignments:', error);
      return [];
    }

    return data || [];
  },

  async getAssignmentsByTeacher(teacherId: string): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        class:classes(*)
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching teacher assignments:', error);
      return [];
    }

    return data || [];
  },

  async getAssignment(assignmentId: string): Promise<Assignment | null> {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        class:classes(*)
      `)
      .eq('id', assignmentId)
      .single();

    if (error) {
      console.error('Error fetching assignment:', error);
      return null;
    }

    return data;
  },

  async createAssignment(assignmentData: {
    title: string;
    description?: string;
    story_id: string;
    story_title: string;
    class_id: string;
    teacher_id: string;
    due_date?: string;
    instructions?: string;
    max_attempts?: number;
  }): Promise<{ data: Assignment | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        max_attempts: 3,
        ...assignmentData,
      })
      .select()
      .single();

    return { data, error };
  },

  async updateAssignment(assignmentId: string, updates: Partial<Assignment>): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', assignmentId);

    return { error };
  },

  async publishAssignment(assignmentId: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('assignments')
      .update({ is_published: true })
      .eq('id', assignmentId);

    return { error };
  },

  async deleteAssignment(assignmentId: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId);

    return { error };
  },
};

// =============================================================================
// RECORDING SERVICES
// =============================================================================

export const recordingService = {
  async getRecordings(): Promise<Recording[]> {
    // SECURITY: Using regular client only - admin operations should use backend API
    const { data, error } = await supabase
      .from('recordings')
      .select(`
        *,
        student:profiles!student_id(*),
        assignment:assignments(*)
      `)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching recordings:', error);
      return [];
    }

    return data || [];
  },

  async getRecordingsByStudent(studentId: string): Promise<Recording[]> {
    const { data, error } = await supabase
      .from('recordings')
      .select(`
        *,
        assignment:assignments(*)
      `)
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching student recordings:', error);
      return [];
    }

    return data || [];
  },

  async getRecordingsByAssignment(assignmentId: string): Promise<Recording[]> {
    const { data, error } = await supabase
      .from('recordings')
      .select(`
        *,
        student:profiles!student_id(*)
      `)
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching assignment recordings:', error);
      return [];
    }

    return data || [];
  },

  async getRecording(recordingId: string): Promise<Recording | null> {
    const { data, error } = await supabase
      .from('recordings')
      .select(`
        *,
        student:profiles!student_id(*),
        assignment:assignments(*)
      `)
      .eq('id', recordingId)
      .single();

    if (error) {
      console.error('Error fetching recording:', error);
      return null;
    }

    return data;
  },

  async createRecording(recordingData: {
    student_id: string;
    assignment_id: string;
    audio_url: string;
    audio_filename: string;
    audio_size_bytes?: number;
    audio_duration_seconds?: number;
    attempt_number?: number;
  }): Promise<{ data: Recording | null; error: Error | null }> {
    // Get the next attempt number for this student/assignment
    if (!recordingData.attempt_number) {
      const { data: existingRecordings } = await supabase
        .from('recordings')
        .select('attempt_number')
        .eq('student_id', recordingData.student_id)
        .eq('assignment_id', recordingData.assignment_id)
        .order('attempt_number', { ascending: false })
        .limit(1);

      const nextAttempt = existingRecordings && existingRecordings.length > 0 
        ? existingRecordings[0].attempt_number + 1 
        : 1;

      recordingData.attempt_number = nextAttempt;
    }

    const { data, error } = await supabase
      .from('recordings')
      .insert(recordingData)
      .select()
      .single();

    return { data, error };
  },

  async updateRecording(recordingId: string, updates: Partial<Recording>): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('recordings')
      .update(updates)
      .eq('id', recordingId);

    return { error };
  },

  async updateRecordingAnalysis(recordingId: string, analysisData: {
    transcript?: string;
    feedback_data?: any;
    accuracy_score?: number;
    reading_pace?: string;
    word_count?: number;
    correct_words?: number;
    status: 'completed' | 'failed';
    error_message?: string;
  }): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('recordings')
      .update({
        ...analysisData,
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    return { error };
  },

  async markRecordingProcessing(recordingId: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('recordings')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    return { error };
  },

  async deleteRecording(recordingId: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('recordings')
      .delete()
      .eq('id', recordingId);

    return { error };
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export const databaseUtils = {
  // Check if user has permission to access a class
  async canAccessClass(userId: string, classId: string): Promise<boolean> {
    const profile = await profileService.getProfile(userId);
    if (!profile) return false;

    if (profile.role === 'admin') return true;
    if (profile.role === 'teacher') {
      const classes = await classService.getClassesByTeacher(userId);
      return classes.some(c => c.id === classId);
    }
    if (profile.role === 'student') {
      return profile.class_id === classId;
    }

    return false;
  },

  // Check if user can access an assignment
  async canAccessAssignment(userId: string, assignmentId: string): Promise<boolean> {
    const assignment = await assignmentService.getAssignment(assignmentId);
    if (!assignment) return false;

    return await this.canAccessClass(userId, assignment.class_id);
  },

  // Get dashboard stats for teachers
  async getTeacherStats(teacherId: string): Promise<{
    classCount: number;
    assignmentCount: number;
    recordingCount: number;
    studentCount: number;
  }> {
    const classes = await classService.getClassesByTeacher(teacherId);
    const assignments = await assignmentService.getAssignmentsByTeacher(teacherId);
    
    // Get student count across all classes
    let studentCount = 0;
    for (const cls of classes) {
      const students = await profileService.getStudentsByClass(cls.id);
      studentCount += students.length;
    }

    // Get recording count for teacher's assignments
    let recordingCount = 0;
    for (const assignment of assignments) {
      const recordings = await recordingService.getRecordingsByAssignment(assignment.id);
      recordingCount += recordings.length;
    }

    return {
      classCount: classes.length,
      assignmentCount: assignments.length,
      recordingCount,
      studentCount,
    };
  },

  // Get dashboard stats for students
  async getStudentStats(studentId: string): Promise<{
    assignmentCount: number;
    recordingCount: number;
    completedAssignments: number;
    averageAccuracy: number;
  }> {
    const profile = await profileService.getProfile(studentId);
    if (!profile?.class_id) {
      return { assignmentCount: 0, recordingCount: 0, completedAssignments: 0, averageAccuracy: 0 };
    }

    const assignments = await assignmentService.getAssignmentsByClass(profile.class_id);
    const recordings = await recordingService.getRecordingsByStudent(studentId);

    const completedAssignments = new Set(recordings.map(r => r.assignment_id)).size;
    
    const accuracyScores = recordings
      .map(r => r.accuracy_score)
      .filter((score): score is number => score !== null && score !== undefined);
    
    const averageAccuracy = accuracyScores.length > 0 
      ? accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length
      : 0;

    return {
      assignmentCount: assignments.length,
      recordingCount: recordings.length,
      completedAssignments,
      averageAccuracy,
    };
  },
};