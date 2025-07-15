import { supabase } from '../lib/supabase';

/**
 * Metadata Management Service
 * 
 * Handles creation, validation, and management of metadata.json files
 * for student recordings with proper schema versioning
 */

export interface RecordingMetadataV1 {
  // Schema version for forward compatibility
  schemaVersion: '1.0';
  
  // Recording identification
  recordingId: string;
  fileName: string;
  filePath: string;
  
  // Student information
  student: {
    id: string;
    name: string;
    email?: string;
  };
  
  // Class information
  class: {
    id: string;
    name: string;
    gradeLevel: number;
    schoolYear: string;
    school: string;
  };
  
  // Assignment information
  assignment?: {
    id: string;
    title: string;
    instructions?: string;
    dueDate?: string;
  };
  
  // Story information
  story: {
    id: string;
    title?: string;
    gradeLevel?: number;
    wordCount?: number;
  };
  
  // Recording details
  recording: {
    duration: number; // in seconds
    fileSize: number; // in bytes
    contentType: string;
    bitRate?: number;
    sampleRate?: number;
    channels?: number;
  };
  
  // Timestamps
  timestamps: {
    submitted: string; // ISO 8601
    created: string; // ISO 8601
    lastModified: string; // ISO 8601
  };
  
  // Processing status
  processing?: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    transcription?: string;
    analysisResults?: {
      wordsPerMinute?: number;
      accuracy?: number;
      fluency?: number;
      pronunciation?: number;
      confidenceScore?: number;
    };
    errors?: string[];
  };
  
  // File organization
  organization: {
    directoryStructure: string;
    pathComponents: {
      schoolYear: string;
      school: string;
      grade: string;
      className: string;
      assignmentId: string;
      studentId: string;
    };
    organizationVersion: string;
    migratedFrom?: string; // Original path if migrated
  };
  
  // Additional metadata
  additional?: {
    deviceInfo?: string;
    browserInfo?: string;
    ipAddress?: string; // Hashed or anonymized
    sessionId?: string;
    userAgent?: string;
    tags?: string[];
    notes?: string;
  };
}

export interface MetadataValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  version?: string;
}

export interface MetadataSearchQuery {
  studentId?: string;
  classId?: string;
  assignmentId?: string;
  storyId?: string;
  gradeLevel?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  processingStatus?: string;
  schoolYear?: string;
}

export class MetadataService {
  private static readonly CURRENT_SCHEMA_VERSION = '1.0';
  private static readonly METADATA_BUCKET = 'student-recordings-metadata';

  /**
   * Generate metadata for a recording
   */
  static async generateMetadata(
    recordingId: string,
    additionalData?: Partial<RecordingMetadataV1['additional']>
  ): Promise<{ metadata?: RecordingMetadataV1; error?: string }> {
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
          assignment_id,
          duration,
          submitted_at,
          status,
          metadata,
          student:profiles!recording_submissions_student_id_fkey(full_name, email),
          class:classes!recording_submissions_class_id_fkey(name, grade_level, teacher_id)
        `)
        .eq('id', recordingId)
        .single();

      if (dbError || !recording) {
        return { error: 'Recording not found in database' };
      }

      // Get story information
      let storyInfo = null;
      try {
        const storyResponse = await fetch('/stories.json');
        if (storyResponse.ok) {
          const stories = await storyResponse.json();
          storyInfo = stories.find((s: any) => s.id === recording.story_id);
        }
      } catch (error) {
        console.warn('Could not fetch story information:', error);
      }

      // Get assignment information if available
      let assignmentInfo = null;
      if (recording.assignment_id) {
        const { data: assignment } = await supabase
          .from('assignments')
          .select('title, instructions, due_date')
          .eq('id', recording.assignment_id)
          .single();
        assignmentInfo = assignment;
      }

      // Extract path components from existing metadata or file path
      const existingMetadata = recording.metadata || {};
      const pathComponents = existingMetadata.pathComponents || {
        schoolYear: new Date().getFullYear().toString(),
        school: 'reading-practice-school',
        grade: `grade-${recording.class?.grade_level || 1}`,
        className: recording.class?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown-class',
        assignmentId: recording.assignment_id ? `assignment-${recording.assignment_id}` : 'free-practice',
        studentId: `student-${recording.student_id}`
      };

      // Build comprehensive metadata
      const metadata: RecordingMetadataV1 = {
        schemaVersion: this.CURRENT_SCHEMA_VERSION,
        
        recordingId: recording.id,
        fileName: recording.file_path.split('/').pop() || 'recording.wav',
        filePath: recording.file_path,
        
        student: {
          id: recording.student_id,
          name: recording.student?.full_name || 'Unknown Student',
          email: recording.student?.email
        },
        
        class: {
          id: recording.class_id,
          name: recording.class?.name || 'Unknown Class',
          gradeLevel: recording.class?.grade_level || 1,
          schoolYear: pathComponents.schoolYear,
          school: pathComponents.school
        },
        
        assignment: assignmentInfo ? {
          id: recording.assignment_id,
          title: assignmentInfo.title,
          instructions: assignmentInfo.instructions,
          dueDate: assignmentInfo.due_date
        } : undefined,
        
        story: {
          id: recording.story_id,
          title: storyInfo?.title,
          gradeLevel: storyInfo?.gradeLevel,
          wordCount: storyInfo?.content?.split(' ').length
        },
        
        recording: {
          duration: recording.duration,
          fileSize: existingMetadata.fileSize || 0,
          contentType: existingMetadata.contentType || 'audio/wav',
          bitRate: existingMetadata.bitRate,
          sampleRate: existingMetadata.sampleRate,
          channels: existingMetadata.channels
        },
        
        timestamps: {
          submitted: recording.submitted_at,
          created: new Date().toISOString(),
          lastModified: new Date().toISOString()
        },
        
        processing: {
          status: recording.status,
          transcription: existingMetadata.transcription,
          analysisResults: existingMetadata.analysisResults,
          errors: existingMetadata.errors
        },
        
        organization: {
          directoryStructure: recording.file_path,
          pathComponents,
          organizationVersion: existingMetadata.organizationVersion || '1.0',
          migratedFrom: existingMetadata.originalPath
        },
        
        additional: additionalData || {}
      };

      return { metadata };
    } catch (error) {
      console.error('Error generating metadata:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error generating metadata'
      };
    }
  }

  /**
   * Save metadata to storage as metadata.json file
   */
  static async saveMetadata(
    metadata: RecordingMetadataV1,
    metadataPath?: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      // Generate metadata file path if not provided
      const path = metadataPath || this.generateMetadataPath(metadata.filePath);
      
      // Convert metadata to JSON
      const metadataJson = JSON.stringify(metadata, null, 2);
      const metadataBlob = new Blob([metadataJson], { type: 'application/json' });

      // Save to storage
      const { data, error } = await supabase.storage
        .from('student-recordings')
        .upload(path, metadataBlob, {
          contentType: 'application/json',
          upsert: true // Allow overwriting existing metadata
        });

      if (error) {
        console.error('Error saving metadata:', error);
        return { success: false, error: error.message };
      }

      console.log(`Metadata saved successfully to: ${path}`);
      return { success: true, path };
    } catch (error) {
      console.error('Error saving metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error saving metadata'
      };
    }
  }

  /**
   * Load metadata from storage
   */
  static async loadMetadata(
    filePath: string
  ): Promise<{ metadata?: RecordingMetadataV1; error?: string }> {
    try {
      const metadataPath = this.generateMetadataPath(filePath);
      
      // Download metadata file
      const { data, error } = await supabase.storage
        .from('student-recordings')
        .download(metadataPath);

      if (error) {
        return { error: `Metadata file not found: ${error.message}` };
      }

      // Parse JSON
      const metadataText = await data.text();
      const metadata = JSON.parse(metadataText) as RecordingMetadataV1;

      // Validate metadata
      const validation = this.validateMetadata(metadata);
      if (!validation.valid) {
        return { error: `Invalid metadata: ${validation.errors.join(', ')}` };
      }

      return { metadata };
    } catch (error) {
      console.error('Error loading metadata:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error loading metadata'
      };
    }
  }

  /**
   * Update existing metadata
   */
  static async updateMetadata(
    filePath: string,
    updates: Partial<RecordingMetadataV1>
  ): Promise<{ success: boolean; metadata?: RecordingMetadataV1; error?: string }> {
    try {
      // Load existing metadata
      const { metadata: existingMetadata, error: loadError } = await this.loadMetadata(filePath);
      
      if (loadError || !existingMetadata) {
        return { success: false, error: loadError || 'Metadata not found' };
      }

      // Merge updates
      const updatedMetadata: RecordingMetadataV1 = {
        ...existingMetadata,
        ...updates,
        timestamps: {
          ...existingMetadata.timestamps,
          lastModified: new Date().toISOString()
        }
      };

      // Save updated metadata
      const { success, error: saveError } = await this.saveMetadata(updatedMetadata);
      
      if (!success) {
        return { success: false, error: saveError };
      }

      return { success: true, metadata: updatedMetadata };
    } catch (error) {
      console.error('Error updating metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating metadata'
      };
    }
  }

  /**
   * Validate metadata against schema
   */
  static validateMetadata(metadata: any): MetadataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!metadata.schemaVersion) {
      errors.push('Missing schemaVersion');
    } else if (metadata.schemaVersion !== this.CURRENT_SCHEMA_VERSION) {
      warnings.push(`Schema version ${metadata.schemaVersion} may be outdated`);
    }

    if (!metadata.recordingId) errors.push('Missing recordingId');
    if (!metadata.fileName) errors.push('Missing fileName');
    if (!metadata.filePath) errors.push('Missing filePath');

    // Validate student information
    if (!metadata.student?.id) errors.push('Missing student.id');
    if (!metadata.student?.name) errors.push('Missing student.name');

    // Validate class information
    if (!metadata.class?.id) errors.push('Missing class.id');
    if (!metadata.class?.name) errors.push('Missing class.name');
    if (typeof metadata.class?.gradeLevel !== 'number') {
      errors.push('Invalid or missing class.gradeLevel');
    }

    // Validate recording details
    if (typeof metadata.recording?.duration !== 'number') {
      errors.push('Invalid or missing recording.duration');
    }
    if (typeof metadata.recording?.fileSize !== 'number') {
      errors.push('Invalid or missing recording.fileSize');
    }

    // Validate timestamps
    if (!metadata.timestamps?.submitted) errors.push('Missing timestamps.submitted');
    if (!metadata.timestamps?.created) errors.push('Missing timestamps.created');
    
    // Validate ISO 8601 format
    try {
      if (metadata.timestamps?.submitted) {
        new Date(metadata.timestamps.submitted).toISOString();
      }
      if (metadata.timestamps?.created) {
        new Date(metadata.timestamps.created).toISOString();
      }
    } catch {
      errors.push('Invalid timestamp format (must be ISO 8601)');
    }

    // Validate organization structure
    if (!metadata.organization?.pathComponents) {
      warnings.push('Missing organization.pathComponents');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      version: metadata.schemaVersion
    };
  }

  /**
   * Search recordings by metadata criteria
   */
  static async searchByMetadata(
    query: MetadataSearchQuery
  ): Promise<{ recordings: RecordingMetadataV1[]; error?: string }> {
    try {
      // Build database query
      let dbQuery = supabase
        .from('recording_submissions')
        .select(`
          id,
          student_id,
          story_id,
          file_path,
          class_id,
          assignment_id,
          duration,
          submitted_at,
          status,
          metadata
        `);

      // Apply filters
      if (query.studentId) {
        dbQuery = dbQuery.eq('student_id', query.studentId);
      }
      if (query.classId) {
        dbQuery = dbQuery.eq('class_id', query.classId);
      }
      if (query.assignmentId) {
        dbQuery = dbQuery.eq('assignment_id', query.assignmentId);
      }
      if (query.storyId) {
        dbQuery = dbQuery.eq('story_id', query.storyId);
      }
      if (query.processingStatus) {
        dbQuery = dbQuery.eq('status', query.processingStatus);
      }
      if (query.dateRange) {
        dbQuery = dbQuery
          .gte('submitted_at', query.dateRange.start)
          .lte('submitted_at', query.dateRange.end);
      }

      const { data: recordings, error } = await dbQuery;

      if (error) {
        throw error;
      }

      // Generate metadata for each recording
      const metadataList: RecordingMetadataV1[] = [];
      
      for (const recording of recordings || []) {
        const { metadata } = await this.generateMetadata(recording.id);
        if (metadata) {
          // Apply additional filters that can't be done in SQL
          if (query.gradeLevel && metadata.class.gradeLevel !== query.gradeLevel) {
            continue;
          }
          if (query.schoolYear && metadata.class.schoolYear !== query.schoolYear) {
            continue;
          }
          
          metadataList.push(metadata);
        }
      }

      return { recordings: metadataList };
    } catch (error) {
      console.error('Error searching metadata:', error);
      return {
        recordings: [],
        error: error instanceof Error ? error.message : 'Unknown error searching metadata'
      };
    }
  }

  /**
   * Generate metadata file path from recording file path
   */
  private static generateMetadataPath(recordingPath: string): string {
    const pathParts = recordingPath.split('/');
    const fileName = pathParts.pop();
    const directory = pathParts.join('/');
    
    // Replace file extension with .metadata.json
    const baseName = fileName?.replace(/\.[^.]+$/, '') || 'recording';
    return `${directory}/${baseName}.metadata.json`;
  }

  /**
   * Migrate metadata for existing recordings
   */
  static async migrateAllMetadata(): Promise<{
    success: boolean;
    processed: number;
    created: number;
    errors: number;
  }> {
    try {
      // Get all recordings
      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('id');

      if (error) {
        throw error;
      }

      let processed = 0;
      let created = 0;
      let errors = 0;

      for (const recording of recordings || []) {
        try {
          // Generate metadata
          const { metadata, error: generateError } = await this.generateMetadata(recording.id);
          
          if (generateError || !metadata) {
            console.error(`Error generating metadata for recording ${recording.id}:`, generateError);
            errors++;
            continue;
          }

          // Save metadata
          const { success } = await this.saveMetadata(metadata);
          
          if (success) {
            created++;
          } else {
            errors++;
          }
          
          processed++;
        } catch (error) {
          console.error(`Error processing recording ${recording.id}:`, error);
          errors++;
        }
      }

      console.log(`Metadata migration completed. Processed: ${processed}, Created: ${created}, Errors: ${errors}`);

      return {
        success: errors === 0,
        processed,
        created,
        errors
      };
    } catch (error) {
      console.error('Error during metadata migration:', error);
      return {
        success: false,
        processed: 0,
        created: 0,
        errors: 1
      };
    }
  }
}