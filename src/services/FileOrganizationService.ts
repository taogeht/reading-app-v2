import { supabase } from '../lib/supabase';

/**
 * File Organization Service
 * 
 * Manages hierarchical directory structure for student recordings:
 * /uploads/recordings/{school-year}/{school}/{grade}/{class}/{assignment}/{student}/
 */

export interface DirectoryPath {
  schoolYear: string;
  school: string;
  grade: string;
  className: string;
  assignmentId: string;
  studentId: string;
}

export interface PathComponents {
  basePath: string;
  fullPath: string;
  fileName: string;
  relativePath: string;
}

export interface StorageMetadata {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  gradeLevel: number;
  assignmentId?: string;
  assignmentTitle?: string;
  storyId: string;
  storyTitle?: string;
  submissionTimestamp: string;
  originalFileName: string;
  fileSize: number;
  contentType: string;
  duration: number;
  school?: string;
}

export class FileOrganizationService {
  // Default values for path components
  private static readonly DEFAULT_SCHOOL = 'reading-practice-school';
  private static readonly RECORDINGS_BASE_PATH = 'recordings';

  /**
   * Generate the current school year string (e.g., "2024-2025")
   */
  private static getCurrentSchoolYear(): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
    
    // School year typically starts in August/September
    // If it's August or later, we're in the new school year
    if (currentMonth >= 8) {
      return `${currentYear}-${currentYear + 1}`;
    } else {
      return `${currentYear - 1}-${currentYear}`;
    }
  }

  /**
   * Sanitize a string for use in file paths
   */
  private static sanitizePathComponent(component: string): string {
    return component
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-') // Replace invalid characters with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Validate path components to prevent directory traversal attacks
   */
  private static validatePathComponent(component: string): boolean {
    // Check for directory traversal attempts
    if (component.includes('..') || component.includes('/') || component.includes('\\')) {
      return false;
    }
    
    // Check for empty or too long components
    if (!component || component.length > 50) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate directory path components from metadata
   */
  static generateDirectoryPath(metadata: StorageMetadata): DirectoryPath {
    const schoolYear = this.getCurrentSchoolYear();
    const school = this.sanitizePathComponent(metadata.school || this.DEFAULT_SCHOOL);
    const grade = `grade-${metadata.gradeLevel}`;
    const className = this.sanitizePathComponent(metadata.className);
    const assignmentId = metadata.assignmentId ? 
      this.sanitizePathComponent(`assignment-${metadata.assignmentId}`) : 
      'free-practice';
    const studentId = this.sanitizePathComponent(`student-${metadata.studentId}`);

    // Validate all components
    const components = [schoolYear, school, grade, className, assignmentId, studentId];
    for (const component of components) {
      if (!this.validatePathComponent(component)) {
        throw new Error(`Invalid path component: ${component}`);
      }
    }

    return {
      schoolYear,
      school,
      grade,
      className,
      assignmentId,
      studentId
    };
  }

  /**
   * Generate full file path including filename
   */
  static generateFilePath(metadata: StorageMetadata): PathComponents {
    const dirPath = this.generateDirectoryPath(metadata);
    
    // Generate safe filename
    const timestamp = new Date(metadata.submissionTimestamp)
      .toISOString()
      .replace(/[:.]/g, '-');
    
    const fileExtension = metadata.contentType === 'audio/wav' ? 'wav' : 
                         metadata.contentType === 'audio/mp3' ? 'mp3' : 
                         'audio';
    
    const fileName = `recording-${timestamp}.${fileExtension}`;
    
    // Build full path
    const relativePath = [
      this.RECORDINGS_BASE_PATH,
      dirPath.schoolYear,
      dirPath.school,
      dirPath.grade,
      dirPath.className,
      dirPath.assignmentId,
      dirPath.studentId
    ].join('/');
    
    const fullPath = `${relativePath}/${fileName}`;
    
    return {
      basePath: this.RECORDINGS_BASE_PATH,
      fullPath,
      fileName,
      relativePath
    };
  }

  /**
   * Create directory structure in Supabase Storage
   * Note: Supabase Storage creates directories implicitly when files are uploaded
   * This method validates the path structure
   */
  static async ensureDirectoryStructure(pathComponents: PathComponents): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Validate the path structure
      const pathSegments = pathComponents.relativePath.split('/');
      
      // Verify the expected structure
      if (pathSegments.length !== 7) { // recordings/year/school/grade/class/assignment/student
        throw new Error(`Invalid path structure. Expected 7 segments, got ${pathSegments.length}`);
      }
      
      const [base, year, school, grade, className, assignment, student] = pathSegments;
      
      if (base !== this.RECORDINGS_BASE_PATH) {
        throw new Error(`Invalid base path: ${base}`);
      }
      
      // Validate year format (YYYY-YYYY)
      if (!/^\d{4}-\d{4}$/.test(year)) {
        throw new Error(`Invalid school year format: ${year}`);
      }
      
      // Validate grade format
      if (!/^grade-\d+$/.test(grade)) {
        throw new Error(`Invalid grade format: ${grade}`);
      }
      
      // All validation passed
      return { success: true };
    } catch (error) {
      console.error('Directory structure validation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Get organized file path for existing recordings (migration helper)
   */
  static async getOrganizedPathForExistingRecording(
    recordingId: string
  ): Promise<{ newPath?: string; metadata?: StorageMetadata; error?: string }> {
    try {
      // Fetch recording data from database
      const { data: recording, error: dbError } = await supabase
        .from('recording_submissions')
        .select(`
          id,
          student_id,
          story_id,
          file_path,
          class_id,
          duration,
          submitted_at,
          metadata,
          student:profiles!recording_submissions_student_id_fkey(full_name, class_id),
          class:classes!recording_submissions_class_id_fkey(name, grade_level)
        `)
        .eq('id', recordingId)
        .single();

      if (dbError || !recording) {
        return { error: 'Recording not found' };
      }

      // Build metadata from database record
      const storageMetadata: StorageMetadata = {
        studentId: recording.student_id,
        studentName: recording.student?.full_name || 'Unknown Student',
        classId: recording.class_id,
        className: recording.class?.name || 'Unknown Class',
        gradeLevel: recording.class?.grade_level || 1,
        assignmentId: recording.assignment_id || recording.metadata?.assignmentId,
        storyId: recording.story_id,
        submissionTimestamp: recording.submitted_at,
        originalFileName: recording.metadata?.originalFileName || 'recording.wav',
        fileSize: recording.metadata?.fileSize || 0,
        contentType: recording.metadata?.contentType || 'audio/wav',
        duration: recording.duration
      };

      // Generate new organized path
      const pathComponents = this.generateFilePath(storageMetadata);
      
      return {
        newPath: pathComponents.fullPath,
        metadata: storageMetadata
      };
    } catch (error) {
      console.error('Error generating organized path:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Move recording to organized directory structure
   */
  static async moveRecordingToOrganizedPath(
    recordingId: string,
    currentPath: string
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    try {
      // Get the organized path for this recording
      const { newPath, metadata, error: pathError } = await this.getOrganizedPathForExistingRecording(recordingId);
      
      if (pathError || !newPath || !metadata) {
        return { success: false, error: pathError || 'Failed to generate new path' };
      }

      // If already in correct location, skip
      if (currentPath === newPath) {
        return { success: true, newPath: currentPath };
      }

      // Ensure directory structure is valid
      const pathComponents = this.generateFilePath(metadata);
      const { success: pathValid, error: validationError } = await this.ensureDirectoryStructure(pathComponents);
      
      if (!pathValid) {
        return { success: false, error: validationError };
      }

      // Move file in Supabase Storage
      const { data: moveData, error: moveError } = await supabase.storage
        .from('student-recordings')
        .move(currentPath, newPath);

      if (moveError) {
        console.error('Storage move error:', moveError);
        return { success: false, error: `Failed to move file: ${moveError.message}` };
      }

      // Update database record with new path
      const { error: updateError } = await supabase
        .from('recording_submissions')
        .update({
          file_path: newPath,
          metadata: {
            ...metadata,
            migratedAt: new Date().toISOString(),
            originalPath: currentPath
          }
        })
        .eq('id', recordingId);

      if (updateError) {
        console.error('Database update error:', updateError);
        // Try to move file back
        try {
          await supabase.storage
            .from('student-recordings')
            .move(newPath, currentPath);
        } catch (rollbackError) {
          console.error('Failed to rollback file move:', rollbackError);
        }
        return { success: false, error: 'Failed to update database record' };
      }

      console.log(`Successfully moved recording ${recordingId} from ${currentPath} to ${newPath}`);
      return { success: true, newPath };
    } catch (error) {
      console.error('Error moving recording:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get storage statistics for monitoring
   */
  static async getStorageStats(options?: {
    schoolYear?: string;
    school?: string;
    grade?: string;
    className?: string;
  }): Promise<{
    totalRecordings: number;
    totalSize: number;
    averageSize: number;
    oldestRecording: string;
    newestRecording: string;
    recordingsByMonth: Record<string, number>;
    error?: string;
  }> {
    try {
      let query = supabase
        .from('recording_submissions')
        .select('submitted_at, metadata, duration, file_path');

      // Apply filters if provided
      if (options?.className) {
        // Filter by class name through join (would need a more complex query)
        // For now, just get all and filter in memory
      }

      const { data: recordings, error } = await query;

      if (error) {
        throw error;
      }

      if (!recordings || recordings.length === 0) {
        return {
          totalRecordings: 0,
          totalSize: 0,
          averageSize: 0,
          oldestRecording: '',
          newestRecording: '',
          recordingsByMonth: {}
        };
      }

      // Calculate statistics
      const totalRecordings = recordings.length;
      const totalSize = recordings.reduce((sum, r) => sum + (r.metadata?.fileSize || 0), 0);
      const averageSize = totalSize / totalRecordings;
      
      const dates = recordings.map(r => new Date(r.submitted_at).getTime()).sort();
      const oldestRecording = new Date(dates[0]).toISOString();
      const newestRecording = new Date(dates[dates.length - 1]).toISOString();

      // Group by month
      const recordingsByMonth: Record<string, number> = {};
      recordings.forEach(recording => {
        const date = new Date(recording.submitted_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        recordingsByMonth[monthKey] = (recordingsByMonth[monthKey] || 0) + 1;
      });

      return {
        totalRecordings,
        totalSize,
        averageSize,
        oldestRecording,
        newestRecording,
        recordingsByMonth
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalRecordings: 0,
        totalSize: 0,
        averageSize: 0,
        oldestRecording: '',
        newestRecording: '',
        recordingsByMonth: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse existing file path to extract components
   */
  static parseExistingPath(filePath: string): {
    isOrganized: boolean;
    components?: DirectoryPath;
    error?: string;
  } {
    try {
      const segments = filePath.split('/');
      
      // Check if it matches the organized structure
      if (segments.length >= 7 && segments[0] === this.RECORDINGS_BASE_PATH) {
        const [, schoolYear, school, grade, className, assignmentId, studentId] = segments;
        
        return {
          isOrganized: true,
          components: {
            schoolYear,
            school,
            grade,
            className,
            assignmentId,
            studentId
          }
        };
      }
      
      return { isOrganized: false };
    } catch (error) {
      return {
        isOrganized: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}