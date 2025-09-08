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

export interface VisualPassword {
  id: string;
  name: string;
  display_emoji: string;
  category: 'animals' | 'shapes' | 'colors' | 'objects';
  sort_order: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
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
    try {
      const response = await fetch(`/api/classes/${classId}/students`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data || [];
      } else {
        console.error('Failed to get students by class:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching students by class:', error);
      return [];
    }
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

// Assignment service with real API calls
export const assignmentService = {
  async getAll(): Promise<Assignment[]> {
    try {
      const response = await fetch('/api/assignments', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data || [];
      } else {
        console.error('Failed to get assignments:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      return [];
    }
  },

  async getAssignments(): Promise<Assignment[]> {
    return this.getAll();
  },

  async getAssignmentsByTeacher(teacherId: string): Promise<Assignment[]> {
    try {
      const response = await fetch(`/api/assignments?teacher_id=${teacherId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data || [];
      } else {
        console.error('Failed to get assignments by teacher:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching assignments by teacher:', error);
      return [];
    }
  },

  async getById(id: string): Promise<Assignment | null> {
    try {
      const response = await fetch(`/api/assignments/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data;
      } else {
        console.error('Failed to get assignment:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
      return null;
    }
  },

  async getByClass(classId: string): Promise<Assignment[]> {
    try {
      const response = await fetch(`/api/assignments?class_id=${classId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data || [];
      } else {
        console.error('Failed to get assignments by class:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching assignments by class:', error);
      return [];
    }
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
  }): Promise<{ data?: Assignment; error?: { message: string } }> {
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...assignmentData,
          max_attempts: assignmentData.max_attempts || 3,
        }),
      });

      const result = await response.json();
      if (result.status === 201) {
        return { data: result.data };
      } else {
        console.error('Failed to create assignment:', result.error);
        return { error: { message: result.error || 'Failed to create assignment' } };
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      return { error: { message: error instanceof Error ? error.message : 'Unknown error' } };
    }
  },

  async publishAssignment(id: string): Promise<{ error?: { message: string } }> {
    try {
      const response = await fetch(`/api/assignments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_published: true }),
      });

      const result = await response.json();
      if (result.status === 200) {
        return {};
      } else {
        console.error('Failed to publish assignment:', result.error);
        return { error: { message: result.error || 'Failed to publish assignment' } };
      }
    } catch (error) {
      console.error('Error publishing assignment:', error);
      return { error: { message: error instanceof Error ? error.message : 'Unknown error' } };
    }
  },

  async update(id: string, updates: Partial<Assignment>): Promise<Assignment | null> {
    try {
      const response = await fetch(`/api/assignments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data;
      } else {
        console.error('Failed to update assignment:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      return null;
    }
  },

  async deleteAssignment(id: string): Promise<{ error?: { message: string } }> {
    try {
      const response = await fetch(`/api/assignments/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return {};
      } else {
        console.error('Failed to delete assignment:', result.error);
        return { error: { message: result.error || 'Failed to delete assignment' } };
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      return { error: { message: error instanceof Error ? error.message : 'Unknown error' } };
    }
  },

  // Legacy method for compatibility
  async delete(id: string): Promise<void> {
    const result = await this.deleteAssignment(id);
    if (result.error) {
      throw new Error(result.error.message);
    }
  }
};

// Recording service with real API calls
export const recordingService = {
  async getAll(): Promise<Recording[]> {
    try {
      const response = await fetch('/api/recordings', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data || [];
      } else {
        console.error('Failed to get recordings:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching recordings:', error);
      return [];
    }
  },

  async getRecordings(): Promise<Recording[]> {
    return this.getAll();
  },

  async getById(id: string): Promise<Recording | null> {
    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data;
      } else {
        console.error('Failed to get recording:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error fetching recording:', error);
      return null;
    }
  },

  async getByAssignment(assignmentId: string): Promise<Recording[]> {
    try {
      const response = await fetch(`/api/recordings?assignment_id=${assignmentId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data || [];
      } else {
        console.error('Failed to get recordings by assignment:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching recordings by assignment:', error);
      return [];
    }
  },

  async getRecordingsByAssignment(assignmentId: string): Promise<Recording[]> {
    return this.getByAssignment(assignmentId);
  },

  async getByStudent(studentId: string): Promise<Recording[]> {
    try {
      const response = await fetch(`/api/recordings?student_id=${studentId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data || [];
      } else {
        console.error('Failed to get recordings by student:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching recordings by student:', error);
      return [];
    }
  },

  async create(recordingData: {
    student_id: string;
    assignment_id: string;
    attempt_number: number;
    audio_url: string;
    audio_filename: string;
    audio_size_bytes?: number | null;
    audio_duration_seconds?: number | null;
    status?: 'uploaded' | 'processing' | 'completed' | 'failed';
    file_path?: string | null;
  }): Promise<Recording | null> {
    try {
      const response = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(recordingData),
      });

      const result = await response.json();
      if (result.status === 201) {
        return result.data;
      } else {
        console.error('Failed to create recording:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error creating recording:', error);
      return null;
    }
  },

  async update(id: string, updates: Partial<Recording>): Promise<Recording | null> {
    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (result.status === 200) {
        return result.data;
      } else {
        console.error('Failed to update recording:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error updating recording:', error);
      return null;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200) {
        return true;
      } else {
        console.error('Failed to delete recording:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
      return false;
    }
  },

  async archive(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'archive' }),
      });

      const result = await response.json();
      return result.status === 200;
    } catch (error) {
      console.error('Error archiving recording:', error);
      return false;
    }
  },

  async unarchive(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'unarchive' }),
      });

      const result = await response.json();
      return result.status === 200;
    } catch (error) {
      console.error('Error unarchiving recording:', error);
      return false;
    }
  },

  async getRecordingUrl(id: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/recordings/${id}/url`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();
      if (result.status === 200 && result.data?.url) {
        return result.data.url;
      } else {
        console.error('Failed to get recording URL:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting recording URL:', error);
      return null;
    }
  }
};