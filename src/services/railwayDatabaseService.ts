// Client-safe mock version of database service
// TODO: Replace with proper API calls to server-side database operations

import { UserProfile } from '../contexts/BetterAuthContext';

// Database types
export interface Class {
  id: string;
  name: string;
  grade_level: number;
  teacher_id: string;
  school_year: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  story_id: string;
  story_title: string;
  class_id: string;
  teacher_id: string;
  due_date: string | null;
  instructions: string | null;
  max_attempts: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  student_id: string;
  assignment_id: string;
  attempt_number: number;
  audio_url: string;
  audio_filename: string;
  audio_size_bytes: number | null;
  audio_duration_seconds: number | null;
  transcript: string | null;
  feedback_data: any | null;
  accuracy_score: number | null;
  reading_pace: 'too-fast' | 'just-right' | 'too-slow' | null;
  word_count: number | null;
  correct_words: number | null;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  processing_started_at: string | null;
  processing_completed_at: string | null;
  error_message: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

// Mock admin functions
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  console.warn('checkIsAdmin not implemented - using mock');
  return false;
};

export const checkIsTeacherOrAdmin = async (userId: string): Promise<boolean> => {
  console.warn('checkIsTeacherOrAdmin not implemented - using mock');
  return false;
};

// Mock profile service
export const profileService = {
  async getAll(): Promise<UserProfile[]> {
    console.warn('profileService.getAll not implemented - using mock');
    return [];
  },

  async getById(id: string): Promise<UserProfile | null> {
    console.warn('profileService.getById not implemented - using mock');
    return null;
  },

  async getByRole(role: 'student' | 'teacher' | 'admin'): Promise<UserProfile[]> {
    console.warn('profileService.getByRole not implemented - using mock');
    return [];
  },

  async getTeachers(): Promise<UserProfile[]> {
    try {
      const response = await fetch('/api/users?role=teacher', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data || [];
      } else {
        console.error('Failed to get teachers:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
      return [];
    }
  },

  async getStudentsByClass(classId: string): Promise<UserProfile[]> {
    console.warn('profileService.getStudentsByClass not implemented - using mock');
    return [];
  },

  async checkTeacherAuthStatus(teacherId: string): Promise<any> {
    console.warn('profileService.checkTeacherAuthStatus not implemented - using mock');
    return { hasAuth: false };
  },

  async deleteTeacher(teacherId: string): Promise<void> {
    console.warn('profileService.deleteTeacher not implemented - using mock');
  },

  async deleteStudent(studentId: string): Promise<void> {
    console.warn('profileService.deleteStudent not implemented - using mock');
  },

  async resetTeacherPassword(teacherId: string): Promise<any> {
    console.warn('profileService.resetTeacherPassword not implemented - using mock');
    return { success: true };
  },

  async repairOrphanedTeacherProfile(teacherId: string): Promise<any> {
    console.warn('profileService.repairOrphanedTeacherProfile not implemented - using mock');
    return { success: true };
  },

  async updateTeacher(teacherId: string, updates: any): Promise<UserProfile> {
    console.warn('profileService.updateTeacher not implemented - using mock');
    return this.update(teacherId, updates);
  },

  async updateStudent(studentId: string, updates: any): Promise<UserProfile> {
    console.warn('profileService.updateStudent not implemented - using mock');
    return this.update(studentId, updates);
  },

  async create(profile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>): Promise<UserProfile> {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(profile),
      });

      const result = await response.json();
      if (result.status === 201) {
        return result.data;
      } else {
        console.error('Failed to create user:', result.error);
        throw new Error(result.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    console.warn('profileService.update not implemented - using mock');
    return {
      id,
      email: 'mock@example.com',
      username: 'mock',
      full_name: 'Mock User',
      role: 'student',
      class_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...updates,
    };
  },

  async delete(id: string): Promise<void> {
    console.warn('profileService.delete not implemented - using mock');
  }
};

// Mock class service
export const classService = {
  async getAll(): Promise<Class[]> {
    try {
      const response = await fetch('/api/classes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data || [];
      } else {
        console.error('Failed to get classes:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      return [];
    }
  },

  async getClasses(): Promise<Class[]> {
    return this.getAll();
  },

  async getById(id: string): Promise<Class | null> {
    try {
      const response = await fetch(`/api/classes/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data;
      } else {
        console.error('Failed to get class:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error fetching class:', error);
      return null;
    }
  },

  async getByTeacher(teacherId: string): Promise<Class[]> {
    try {
      const response = await fetch(`/api/classes?teacher_id=${teacherId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data || [];
      } else {
        console.error('Failed to get classes by teacher:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching classes by teacher:', error);
      return [];
    }
  },

  async create(classData: Omit<Class, 'id' | 'created_at' | 'updated_at'>): Promise<Class> {
    try {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(classData),
      });

      const result = await response.json();
      if (result.status === 201) {
        return result.data;
      } else {
        console.error('Failed to create class:', result.error);
        throw new Error(result.error || 'Failed to create class');
      }
    } catch (error) {
      console.error('Error creating class:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Class>): Promise<Class> {
    try {
      const response = await fetch(`/api/classes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data;
      } else {
        console.error('Failed to update class:', result.error);
        throw new Error(result.error || 'Failed to update class');
      }
    } catch (error) {
      console.error('Error updating class:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const response = await fetch(`/api/classes/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status !== 200) {
        console.error('Failed to delete class:', result.error);
        throw new Error(result.error || 'Failed to delete class');
      }
    } catch (error) {
      console.error('Error deleting class:', error);
      throw error;
    }
  },

  async deleteClass(classId: string): Promise<void> {
    return this.delete(classId);
  }
};

// Mock assignment service
export const assignmentService = {
  async getAll(): Promise<Assignment[]> {
    console.warn('assignmentService.getAll not implemented - using mock');
    return [];
  },

  async getAssignments(): Promise<Assignment[]> {
    console.warn('assignmentService.getAssignments not implemented - using mock');
    return [];
  },

  async getById(id: string): Promise<Assignment | null> {
    console.warn('assignmentService.getById not implemented - using mock');
    return null;
  },

  async getByClass(classId: string): Promise<Assignment[]> {
    console.warn('assignmentService.getByClass not implemented - using mock');
    return [];
  },

  async create(assignment: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>): Promise<Assignment> {
    console.warn('assignmentService.create not implemented - using mock');
    return {
      id: 'mock-assignment-id',
      title: assignment.title,
      description: assignment.description,
      story_id: assignment.story_id,
      story_title: assignment.story_title,
      class_id: assignment.class_id,
      teacher_id: assignment.teacher_id,
      due_date: assignment.due_date,
      instructions: assignment.instructions,
      max_attempts: assignment.max_attempts,
      is_published: assignment.is_published,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async update(id: string, updates: Partial<Assignment>): Promise<Assignment> {
    console.warn('assignmentService.update not implemented - using mock');
    return {
      id,
      title: 'Mock Assignment',
      description: null,
      story_id: 'mock-story',
      story_title: 'Mock Story',
      class_id: 'mock-class',
      teacher_id: 'mock-teacher',
      due_date: null,
      instructions: null,
      max_attempts: 3,
      is_published: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...updates,
    };
  },

  async delete(id: string): Promise<void> {
    console.warn('assignmentService.delete not implemented - using mock');
  }
};

// Mock recording service
export const recordingService = {
  async getAll(): Promise<Recording[]> {
    console.warn('recordingService.getAll not implemented - using mock');
    return [];
  },

  async getRecordings(): Promise<Recording[]> {
    console.warn('recordingService.getRecordings not implemented - using mock');
    return [];
  },

  async getById(id: string): Promise<Recording | null> {
    console.warn('recordingService.getById not implemented - using mock');
    return null;
  },

  async getByAssignment(assignmentId: string): Promise<Recording[]> {
    console.warn('recordingService.getByAssignment not implemented - using mock');
    return [];
  },

  async create(recording: Omit<Recording, 'id' | 'created_at' | 'updated_at'>): Promise<Recording> {
    console.warn('recordingService.create not implemented - using mock');
    return {
      id: 'mock-recording-id',
      student_id: recording.student_id,
      assignment_id: recording.assignment_id,
      attempt_number: recording.attempt_number,
      audio_url: recording.audio_url,
      audio_filename: recording.audio_filename,
      audio_size_bytes: recording.audio_size_bytes,
      audio_duration_seconds: recording.audio_duration_seconds,
      transcript: recording.transcript,
      feedback_data: recording.feedback_data,
      accuracy_score: recording.accuracy_score,
      reading_pace: recording.reading_pace,
      word_count: recording.word_count,
      correct_words: recording.correct_words,
      status: recording.status,
      processing_started_at: recording.processing_started_at,
      processing_completed_at: recording.processing_completed_at,
      error_message: recording.error_message,
      submitted_at: recording.submitted_at,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async update(id: string, updates: Partial<Recording>): Promise<Recording> {
    console.warn('recordingService.update not implemented - using mock');
    return {
      id,
      student_id: 'mock-student',
      assignment_id: 'mock-assignment',
      attempt_number: 1,
      audio_url: 'mock-url',
      audio_filename: 'mock-file',
      audio_size_bytes: null,
      audio_duration_seconds: null,
      transcript: null,
      feedback_data: null,
      accuracy_score: null,
      reading_pace: null,
      word_count: null,
      correct_words: null,
      status: 'uploaded',
      processing_started_at: null,
      processing_completed_at: null,
      error_message: null,
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...updates,
    };
  },

  async delete(id: string): Promise<void> {
    console.warn('recordingService.delete not implemented - using mock');
  }
};