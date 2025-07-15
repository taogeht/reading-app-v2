import { query } from '../lib/database';
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

// =============================================================================
// ADMIN HELPER FUNCTIONS
// =============================================================================

export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    const result = await query('SELECT role FROM profiles WHERE id = $1', [userId]);
    return result.rows[0]?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

export const checkIsTeacherOrAdmin = async (userId: string): Promise<boolean> => {
  try {
    const result = await query('SELECT role FROM profiles WHERE id = $1', [userId]);
    const role = result.rows[0]?.role;
    return role === 'teacher' || role === 'admin';
  } catch (error) {
    console.error('Error checking teacher/admin status:', error);
    return false;
  }
};

// =============================================================================
// PROFILE SERVICE
// =============================================================================

export const profileService = {
  async getAll(): Promise<UserProfile[]> {
    try {
      const result = await query('SELECT * FROM profiles ORDER BY created_at DESC');
      return result.rows;
    } catch (error) {
      console.error('Error fetching profiles:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<UserProfile | null> {
    try {
      const result = await query('SELECT * FROM profiles WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  },

  async getByRole(role: 'student' | 'teacher' | 'admin'): Promise<UserProfile[]> {
    try {
      const result = await query('SELECT * FROM profiles WHERE role = $1 ORDER BY full_name', [role]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching profiles by role:', error);
      throw error;
    }
  },

  async create(profile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>): Promise<UserProfile> {
    try {
      const result = await query(
        'INSERT INTO profiles (email, username, full_name, role, class_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [profile.email, profile.username, profile.full_name, profile.role, profile.class_id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const values = [id, ...Object.values(updates)];
      
      const result = await query(
        `UPDATE profiles SET ${setClause} WHERE id = $1 RETURNING *`,
        values
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await query('DELETE FROM profiles WHERE id = $1', [id]);
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  }
};

// =============================================================================
// CLASS SERVICE
// =============================================================================

export const classService = {
  async getAll(): Promise<Class[]> {
    try {
      const result = await query('SELECT * FROM classes ORDER BY created_at DESC');
      return result.rows;
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Class | null> {
    try {
      const result = await query('SELECT * FROM classes WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching class:', error);
      throw error;
    }
  },

  async getByTeacher(teacherId: string): Promise<Class[]> {
    try {
      const result = await query('SELECT * FROM classes WHERE teacher_id = $1 ORDER BY name', [teacherId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching classes by teacher:', error);
      throw error;
    }
  },

  async create(classData: Omit<Class, 'id' | 'created_at' | 'updated_at'>): Promise<Class> {
    try {
      const result = await query(
        'INSERT INTO classes (name, grade_level, teacher_id, school_year, description, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [classData.name, classData.grade_level, classData.teacher_id, classData.school_year, classData.description, classData.is_active]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating class:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Class>): Promise<Class> {
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const values = [id, ...Object.values(updates)];
      
      const result = await query(
        `UPDATE classes SET ${setClause} WHERE id = $1 RETURNING *`,
        values
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating class:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await query('DELETE FROM classes WHERE id = $1', [id]);
    } catch (error) {
      console.error('Error deleting class:', error);
      throw error;
    }
  }
};

// =============================================================================
// ASSIGNMENT SERVICE
// =============================================================================

export const assignmentService = {
  async getAll(): Promise<Assignment[]> {
    try {
      const result = await query('SELECT * FROM assignments ORDER BY created_at DESC');
      return result.rows;
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Assignment | null> {
    try {
      const result = await query('SELECT * FROM assignments WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching assignment:', error);
      throw error;
    }
  },

  async getByClass(classId: string): Promise<Assignment[]> {
    try {
      const result = await query('SELECT * FROM assignments WHERE class_id = $1 ORDER BY created_at DESC', [classId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching assignments by class:', error);
      throw error;
    }
  },

  async create(assignment: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>): Promise<Assignment> {
    try {
      const result = await query(
        'INSERT INTO assignments (title, description, story_id, story_title, class_id, teacher_id, due_date, instructions, max_attempts, is_published) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [assignment.title, assignment.description, assignment.story_id, assignment.story_title, assignment.class_id, assignment.teacher_id, assignment.due_date, assignment.instructions, assignment.max_attempts, assignment.is_published]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Assignment>): Promise<Assignment> {
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const values = [id, ...Object.values(updates)];
      
      const result = await query(
        `UPDATE assignments SET ${setClause} WHERE id = $1 RETURNING *`,
        values
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating assignment:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await query('DELETE FROM assignments WHERE id = $1', [id]);
    } catch (error) {
      console.error('Error deleting assignment:', error);
      throw error;
    }
  }
};

// =============================================================================
// RECORDING SERVICE
// =============================================================================

export const recordingService = {
  async getAll(): Promise<Recording[]> {
    try {
      const result = await query('SELECT * FROM recordings ORDER BY created_at DESC');
      return result.rows;
    } catch (error) {
      console.error('Error fetching recordings:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Recording | null> {
    try {
      const result = await query('SELECT * FROM recordings WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching recording:', error);
      throw error;
    }
  },

  async getByAssignment(assignmentId: string): Promise<Recording[]> {
    try {
      const result = await query('SELECT * FROM recordings WHERE assignment_id = $1 ORDER BY created_at DESC', [assignmentId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching recordings by assignment:', error);
      throw error;
    }
  },

  async create(recording: Omit<Recording, 'id' | 'created_at' | 'updated_at'>): Promise<Recording> {
    try {
      const result = await query(
        'INSERT INTO recordings (student_id, assignment_id, attempt_number, audio_url, audio_filename, audio_size_bytes, audio_duration_seconds, transcript, feedback_data, accuracy_score, reading_pace, word_count, correct_words, status, processing_started_at, processing_completed_at, error_message, submitted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *',
        [recording.student_id, recording.assignment_id, recording.attempt_number, recording.audio_url, recording.audio_filename, recording.audio_size_bytes, recording.audio_duration_seconds, recording.transcript, recording.feedback_data, recording.accuracy_score, recording.reading_pace, recording.word_count, recording.correct_words, recording.status, recording.processing_started_at, recording.processing_completed_at, recording.error_message, recording.submitted_at]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating recording:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Recording>): Promise<Recording> {
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const values = [id, ...Object.values(updates)];
      
      const result = await query(
        `UPDATE recordings SET ${setClause} WHERE id = $1 RETURNING *`,
        values
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating recording:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await query('DELETE FROM recordings WHERE id = $1', [id]);
    } catch (error) {
      console.error('Error deleting recording:', error);
      throw error;
    }
  }
};