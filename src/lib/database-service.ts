// Real database service for BetterAuth integration
// Server-side only - handles actual database operations

import { pool } from './database';
import { UserSession } from '../api/auth/index';
import { VisualPassword } from '../api/visual-passwords/index';
import bcrypt from 'bcrypt';

export interface DatabaseUserProfile {
  id: string;
  email: string;
  username?: string;
  full_name: string | null;
  role: 'student' | 'teacher' | 'admin';
  class_id: string | null;
  visual_password_id: string | null;
  password_hash?: string | null; // For teachers/admins
  created_at: string;
  updated_at: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  grade_level: number;
  teacher_id: string;
  access_token: string;
  allow_student_access: boolean;
  school_year: string | null;
  description: string | null;
  is_active: boolean;
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
  is_archived?: boolean;
  file_path?: string;
  student_name?: string;
  assignment_title?: string;
}

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

// Helper function to wait for database pool initialization
async function waitForPool(): Promise<boolean> {
  if (isBrowser) {
    return false;
  }

  let attempts = 0;
  while (!pool && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  return !!pool;
}

export class DatabaseService {
  // Get user profile by email
  static async getUserByEmail(email: string): Promise<DatabaseUserProfile | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.getUserByEmail not available - pool not ready');
      return null;
    }

    try {
      const result = await pool.query(
        'SELECT * FROM profiles WHERE email = $1 LIMIT 1',
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  // Get user profile by ID
  static async getUserById(id: string): Promise<DatabaseUserProfile | null> {
    if (isBrowser) {
      console.warn('DatabaseService.getUserById not available in browser');
      return null;
    }

    try {
      const result = await pool.query(
        'SELECT * FROM profiles WHERE id = $1 LIMIT 1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  // Create new user profile
  static async createUserProfile(data: {
    email: string;
    full_name: string;
    role: 'student' | 'teacher' | 'admin';
    username?: string;
    class_id?: string;
    visual_password_id?: string;
  }): Promise<DatabaseUserProfile | null> {
    if (isBrowser) {
      console.warn('DatabaseService.createUserProfile not available in browser');
      return null;
    }

    try {
      const result = await pool.query(
        `INSERT INTO profiles (email, username, full_name, role, class_id, visual_password_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [
          data.email,
          data.username || data.email.split('@')[0],
          data.full_name,
          data.role,
          data.class_id || null,
          data.visual_password_id || null,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating user profile:', error);
      return null;
    }
  }

  // Update user profile
  static async updateUserProfile(id: string, updates: Partial<DatabaseUserProfile>): Promise<DatabaseUserProfile | null> {
    if (isBrowser) {
      console.warn('DatabaseService.updateUserProfile not available in browser');
      return null;
    }

    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created_at') {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        return await this.getUserById(id);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE profiles 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return null;
    }
  }

  // Get class by access token
  static async getClassByAccessToken(accessToken: string): Promise<ClassInfo | null> {
    if (isBrowser) {
      console.warn('DatabaseService.getClassByAccessToken not available in browser');
      return null;
    }

    try {
      const result = await pool.query(
        'SELECT * FROM classes WHERE access_token = $1 AND is_active = true LIMIT 1',
        [accessToken]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting class by access token:', error);
      return null;
    }
  }

  // Get visual passwords
  static async getVisualPasswords(): Promise<VisualPassword[]> {
    if (isBrowser) {
      console.warn('DatabaseService.getVisualPasswords not available in browser');
      return [];
    }

    // Wait for pool to be available with longer timeout
    let attempts = 0;
    while (!pool && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!pool) {
      console.error('Database pool is not available after waiting');
      return [];
    }

    try {
      const result = await pool.query(
        'SELECT id, name, display_emoji, category, sort_order FROM visual_passwords WHERE is_active = true ORDER BY category, sort_order, name'
      );

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        display_emoji: row.display_emoji,
        category: row.category,
        sort_order: row.sort_order || 0,
      }));
    } catch (error) {
      console.error('Error getting visual passwords:', error);
      return [];
    }
  }

  // Authenticate student with visual password
  static async authenticateStudentWithVisualPassword(
    classAccessToken: string,
    studentName: string,
    visualPasswordId: string
  ): Promise<{ success: boolean; user?: DatabaseUserProfile; error?: string }> {
    if (isBrowser) {
      console.warn('DatabaseService.authenticateStudentWithVisualPassword not available in browser');
      return { success: false, error: 'Not available in browser' };
    }

    try {
      // First, verify the class exists and allows student access
      const classInfo = await this.getClassByAccessToken(classAccessToken);
      if (!classInfo || !classInfo.allow_student_access) {
        return { success: false, error: 'Invalid class access code' };
      }

      // Check if student already exists
      const existingStudent = await pool.query(
        'SELECT * FROM profiles WHERE full_name = $1 AND class_id = $2 AND role = $3 LIMIT 1',
        [studentName, classInfo.id, 'student']
      );

      let student: DatabaseUserProfile;

      if (existingStudent.rows.length > 0) {
        // Update existing student with visual password
        student = await this.updateUserProfile(existingStudent.rows[0].id, {
          visual_password_id: visualPasswordId,
        }) as DatabaseUserProfile;
      } else {
        // Create new student
        const email = `${studentName.toLowerCase().replace(/\s+/g, '.')}@student.${classInfo.access_token}.local`;
        
        const newStudent = await this.createUserProfile({
          email,
          full_name: studentName,
          role: 'student',
          class_id: classInfo.id,
          visual_password_id: visualPasswordId,
        });

        if (!newStudent) {
          return { success: false, error: 'Failed to create student profile' };
        }

        student = newStudent;
      }

      return { success: true, user: student };
    } catch (error) {
      console.error('Error authenticating student with visual password:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  // Get users with role filtering
  static async getUsers(role?: 'student' | 'teacher' | 'admin'): Promise<DatabaseUserProfile[]> {
    if (isBrowser) {
      console.warn('DatabaseService.getUsers not available in browser');
      return [];
    }

    try {
      let query = 'SELECT * FROM profiles WHERE 1=1';
      const values: any[] = [];

      if (role) {
        query += ' AND role = $1';
        values.push(role);
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  // Test database connection
  static async testConnection(): Promise<boolean> {
    if (isBrowser) {
      console.warn('DatabaseService.testConnection not available in browser');
      return false;
    }

    try {
      const result = await pool.query('SELECT NOW() as current_time');
      console.log('Database connection test successful:', result.rows[0]);
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  // Class management methods
  static async getAllClasses(): Promise<ClassInfo[]> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.getAllClasses not available - pool not ready');
      return [];
    }

    try {
      const result = await pool.query(
        'SELECT * FROM classes ORDER BY created_at DESC'
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting all classes:', error);
      return [];
    }
  }

  static async getClassesByTeacher(teacherId: string): Promise<ClassInfo[]> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.getClassesByTeacher not available - pool not ready');
      return [];
    }

    try {
      const result = await pool.query(
        'SELECT * FROM classes WHERE teacher_id = $1 ORDER BY created_at DESC',
        [teacherId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting classes by teacher:', error);
      return [];
    }
  }

  static async getClassById(classId: string): Promise<ClassInfo | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.getClassById not available - pool not ready');
      return null;
    }

    try {
      const result = await pool.query(
        'SELECT * FROM classes WHERE id = $1 LIMIT 1',
        [classId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting class by ID:', error);
      return null;
    }
  }

  static async createClass(data: {
    name: string;
    grade_level: number;
    teacher_id: string;
    school_year?: string;
    description?: string;
    allow_student_access?: boolean;
  }): Promise<ClassInfo | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.createClass not available - pool not ready');
      return null;
    }

    try {
      // Generate unique access token
      const accessToken = `CLASS_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const result = await pool.query(
        `INSERT INTO classes (name, grade_level, teacher_id, access_token, allow_student_access, school_year, description, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         RETURNING *`,
        [
          data.name,
          data.grade_level,
          data.teacher_id,
          accessToken,
          data.allow_student_access !== false,
          data.school_year || null,
          data.description || null,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating class:', error);
      return null;
    }
  }

  static async updateClass(classId: string, updates: Partial<ClassInfo>): Promise<ClassInfo | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.updateClass not available - pool not ready');
      return null;
    }

    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created_at' && key !== 'access_token') {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        return await this.getClassById(classId);
      }

      fields.push(`updated_at = NOW()`);
      values.push(classId);

      const query = `
        UPDATE classes 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating class:', error);
      return null;
    }
  }

  static async deleteClass(classId: string): Promise<boolean> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.deleteClass not available - pool not ready');
      return false;
    }

    try {
      const result = await pool.query(
        'DELETE FROM classes WHERE id = $1',
        [classId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting class:', error);
      return false;
    }
  }

  // Recording management methods
  static async getRecordingsByClass(classId: string): Promise<Recording[]> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.getRecordingsByClass not available - pool not ready');
      return [];
    }

    try {
      const result = await pool.query(
        `SELECT r.*, p.full_name as student_name, a.title as assignment_title 
         FROM recordings r
         LEFT JOIN profiles p ON r.student_id = p.id
         LEFT JOIN assignments a ON r.assignment_id = a.id
         WHERE a.class_id = $1
         ORDER BY r.submitted_at DESC`,
        [classId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting recordings by class:', error);
      return [];
    }
  }

  static async getRecordingById(recordingId: string): Promise<Recording | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.getRecordingById not available - pool not ready');
      return null;
    }

    try {
      const result = await pool.query(
        'SELECT * FROM recordings WHERE id = $1 LIMIT 1',
        [recordingId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting recording by ID:', error);
      return null;
    }
  }

  static async createRecording(data: any): Promise<Recording | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.createRecording not available - pool not ready');
      return null;
    }

    try {
      const result = await pool.query(
        `INSERT INTO recordings (
          student_id, assignment_id, attempt_number, audio_url, audio_filename,
          audio_size_bytes, audio_duration_seconds, status, submitted_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
        RETURNING *`,
        [
          data.student_id,
          data.assignment_id,
          data.attempt_number || 1,
          data.audio_url,
          data.audio_filename,
          data.audio_size_bytes || null,
          data.audio_duration_seconds || null,
          data.status || 'uploaded',
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating recording:', error);
      return null;
    }
  }

  static async updateRecording(recordingId: string, updates: any): Promise<Recording | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.updateRecording not available - pool not ready');
      return null;
    }

    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created_at') {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        return await this.getRecordingById(recordingId);
      }

      fields.push(`updated_at = NOW()`);
      values.push(recordingId);

      const query = `
        UPDATE recordings 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating recording:', error);
      return null;
    }
  }

  static async archiveRecording(recordingId: string): Promise<boolean> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.archiveRecording not available - pool not ready');
      return false;
    }

    try {
      const result = await pool.query(
        'UPDATE recordings SET is_archived = true, updated_at = NOW() WHERE id = $1',
        [recordingId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error archiving recording:', error);
      return false;
    }
  }

  static async unarchiveRecording(recordingId: string): Promise<boolean> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.unarchiveRecording not available - pool not ready');
      return false;
    }

    try {
      const result = await pool.query(
        'UPDATE recordings SET is_archived = false, updated_at = NOW() WHERE id = $1',
        [recordingId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error unarchiving recording:', error);
      return false;
    }
  }

  static async deleteRecording(recordingId: string): Promise<boolean> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.deleteRecording not available - pool not ready');
      return false;
    }

    try {
      const result = await pool.query(
        'DELETE FROM recordings WHERE id = $1',
        [recordingId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting recording:', error);
      return false;
    }
  }

  // Password hashing and verification methods
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // High security
    return await bcrypt.hash(password, saltRounds);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  // Authenticate teacher with username and password
  static async authenticateUsernamePassword(username: string, password: string): Promise<DatabaseUserProfile | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.authenticateUsernamePassword not available - pool not ready');
      return null;
    }

    try {
      // Get user by username (teachers)
      const user = await this.getUserByUsername(username);
      if (!user || !user.password_hash) {
        return null;
      }

      // Verify password
      const isValid = await this.verifyPassword(password, user.password_hash);
      if (!isValid) {
        return null;
      }

      // Return user profile (without password hash)
      const { password_hash, ...userProfile } = user;
      return userProfile;
    } catch (error) {
      console.error('Error authenticating username/password:', error);
      return null;
    }
  }

  // Authenticate teacher/admin with email and password
  static async authenticateEmailPassword(email: string, password: string): Promise<DatabaseUserProfile | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.authenticateEmailPassword not available - pool not ready');
      return null;
    }

    try {
      const result = await pool.query(
        'SELECT * FROM profiles WHERE email = $1 AND role IN ($2, $3) LIMIT 1',
        [email, 'teacher', 'admin']
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      
      // Check if user has a password hash
      if (!user.password_hash) {
        console.warn('User has no password hash:', email);
        return null;
      }

      // Verify password
      const isValid = await this.verifyPassword(password, user.password_hash);
      if (!isValid) {
        return null;
      }

      // Remove password hash from returned data
      delete user.password_hash;
      return user;
    } catch (error) {
      console.error('Error authenticating email/password:', error);
      return null;
    }
  }

  // Create user with hashed password (for teachers/admins)
  static async createUserWithPassword(userData: {
    email: string;
    password: string;
    full_name: string;
    role: 'teacher' | 'admin';
    username?: string;
  }): Promise<DatabaseUserProfile | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.createUserWithPassword not available - pool not ready');
      return null;
    }

    try {
      // Hash the password
      const password_hash = await this.hashPassword(userData.password);

      const result = await pool.query(
        `INSERT INTO profiles (
          email, username, full_name, role, password_hash,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, email, username, full_name, role, class_id, visual_password_id, created_at, updated_at`,
        [
          userData.email,
          userData.username || userData.email.split('@')[0],
          userData.full_name,
          userData.role,
          password_hash,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating user with password:', error);
      return null;
    }
  }

  // Update user password (for existing accounts)
  static async updateUserPassword(email: string, newPassword: string): Promise<boolean> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.updateUserPassword not available - pool not ready');
      return false;
    }

    try {
      // Hash the new password
      const password_hash = await this.hashPassword(newPassword);

      const result = await pool.query(
        `UPDATE profiles 
         SET password_hash = $1, updated_at = NOW()
         WHERE email = $2`,
        [password_hash, email]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error updating user password:', error);
      return false;
    }
  }

  // Get all users (for admin management)
  static async getAllUsers(): Promise<DatabaseUserProfile[]> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.getAllUsers not available - pool not ready');
      return [];
    }

    try {
      const result = await pool.query(
        `SELECT id, email, username, full_name, role, class_id, visual_password_id, created_at, updated_at 
         FROM profiles 
         ORDER BY created_at DESC`
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  // Get user by username (for teacher authentication)
  static async getUserByUsername(username: string): Promise<DatabaseUserProfile | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.getUserByUsername not available - pool not ready');
      return null;
    }

    try {
      const result = await pool.query(
        `SELECT id, email, username, full_name, role, class_id, visual_password_id, password_hash, created_at, updated_at 
         FROM profiles 
         WHERE username = $1`,
        [username]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  // Get users by role (teachers, students, admins)
  static async getUsersByRole(role: 'student' | 'teacher' | 'admin'): Promise<DatabaseUserProfile[]> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.getUsersByRole not available - pool not ready');
      return [];
    }

    try {
      const result = await pool.query(
        `SELECT id, email, username, full_name, role, class_id, visual_password_id, created_at, updated_at 
         FROM profiles 
         WHERE role = $1 
         ORDER BY created_at DESC`,
        [role]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting users by role:', error);
      return [];
    }
  }

  // Update user (general method for profile updates)
  static async updateUser(id: string, updates: Partial<DatabaseUserProfile>): Promise<DatabaseUserProfile | null> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.updateUser not available - pool not ready');
      return null;
    }

    try {
      // Build dynamic SET clause
      const setFields = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created_at' && key !== 'updated_at' && value !== undefined) {
          setFields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setFields.length === 0) {
        return await this.getUserById(id);
      }

      values.push(id); // Add ID as last parameter
      const query = `
        UPDATE profiles 
        SET ${setFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING id, email, username, full_name, role, class_id, visual_password_id, created_at, updated_at
      `;

      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  // Delete user
  static async deleteUser(id: string): Promise<boolean> {
    const poolAvailable = await waitForPool();
    if (!poolAvailable) {
      console.warn('DatabaseService.deleteUser not available - pool not ready');
      return false;
    }

    try {
      const result = await pool.query(
        `DELETE FROM profiles WHERE id = $1`,
        [id]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }
}

// Export types
export type { DatabaseUserProfile, ClassInfo, Recording };