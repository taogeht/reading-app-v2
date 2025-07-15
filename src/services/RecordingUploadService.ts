import { supabase } from '../lib/supabase';
import { FileOrganizationService, type StorageMetadata } from './FileOrganizationService';
import { MetadataService } from './MetadataService';
import { analyzeRecording } from '../utils/audioAnalysis';
import { FeedbackData } from '../types';

// Create a separate client without auth for student uploads
const createStudentUploadClient = () => {
  // For student uploads, we'll use a temporary session approach
  // Since students don't have Supabase auth, we bypass auth for file uploads
  return supabase;
};

export interface RecordingMetadata {
  storyId: string;
  storyText?: string; // Add story text for analysis
  duration: number;
  submittedAt: string;
  assignmentId?: string;
}

export interface RecordingSubmission {
  id: string;
  student_id: string;
  story_id: string;
  file_path: string;
  duration: number;
  submitted_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  assignment_id?: string;
  archived?: boolean;
  metadata?: Record<string, any>;
  speech_analysis?: FeedbackData; // Add speech analysis data
  student?: {
    full_name: string;
  }; // Add student information for display
}

export class RecordingUploadService {
  /**
   * Upload a student recording to storage and create database record
   */
  static async uploadRecording(
    audioBlob: Blob,
    metadata: RecordingMetadata,
    studentId: string,
    classId: string
  ): Promise<{ success: boolean; submissionId?: string; error?: string }> {
    try {
      // First, get class and student information for organized path generation
      const { data: classInfo, error: classError } = await supabase
        .from('classes')
        .select('name, grade_level')
        .eq('id', classId)
        .single();

      if (classError || !classInfo) {
        console.error('Error fetching class info:', classError);
        return { success: false, error: 'Class information not found' };
      }

      const { data: studentInfo, error: studentError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', studentId)
        .single();

      if (studentError || !studentInfo) {
        console.error('Error fetching student info:', studentError);
        return { success: false, error: 'Student information not found' };
      }

      // Create storage metadata for organized file path
      const storageMetadata: StorageMetadata = {
        studentId,
        studentName: studentInfo.full_name,
        classId,
        className: classInfo.name,
        gradeLevel: classInfo.grade_level,
        assignmentId: metadata.assignmentId,
        storyId: metadata.storyId,
        submissionTimestamp: metadata.submittedAt,
        originalFileName: `recording-${studentId}-${metadata.storyId}.wav`,
        fileSize: audioBlob.size,
        contentType: audioBlob.type || 'audio/wav',
        duration: metadata.duration
      };

      // Generate organized file path
      const pathComponents = FileOrganizationService.generateFilePath(storageMetadata);
      
      // Validate directory structure
      const { success: pathValid, error: pathError } = await FileOrganizationService.ensureDirectoryStructure(pathComponents);
      if (!pathValid) {
        return { success: false, error: `Invalid file path: ${pathError}` };
      }

      const filePath = pathComponents.fullPath;
      console.log('Uploading to organized path:', filePath);

      // Upload file to Supabase Storage with explicit options
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('student-recordings')
        .upload(filePath, audioBlob, {
          contentType: 'audio/wav',
          upsert: false,
          duplex: 'half' // Add this for better browser compatibility
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return { 
          success: false, 
          error: `Upload failed: ${uploadError.message}` 
        };
      }

      console.log('File uploaded successfully:', uploadData);

      // Create database record with fallback for missing assignment_id column
      let submissionData: any = {
        student_id: studentId,
        story_id: metadata.storyId,
        class_id: classId,
        file_path: filePath,
        duration: metadata.duration,
        submitted_at: metadata.submittedAt,
        status: 'pending' as const,
        metadata: {
          ...storageMetadata,
          uploadPath: filePath,
          pathComponents: pathComponents,
          assignmentId: metadata.assignmentId, // Store assignment ID in metadata as fallback
          organizationVersion: '1.0' // Track file organization schema version
        }
      };

      // Try to include assignment_id column if it exists
      if (metadata.assignmentId) {
        submissionData.assignment_id = metadata.assignmentId;
      }

      console.log('Inserting submission data:', submissionData);

      // Use the secure RPC function to submit recording (bypasses RLS issues)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('submit_student_recording', {
          p_student_id: studentId,
          p_story_id: metadata.storyId,
          p_class_id: classId,
          p_file_path: filePath,
          p_duration: metadata.duration,
          p_metadata: {
            ...storageMetadata,
            uploadPath: filePath,
            pathComponents: pathComponents,
            assignmentId: metadata.assignmentId,
            organizationVersion: '1.0'
          }
        });

      let dbData: any = null;
      let dbError: any = null;

      if (rpcError) {
        console.error('RPC submission error:', rpcError);
        dbError = rpcError;
      } else if (rpcData && rpcData.success) {
        console.log('RPC submission successful:', rpcData);
        dbData = { id: rpcData.submission_id };
      } else {
        console.error('RPC submission failed:', rpcData);
        dbError = { message: rpcData?.error || 'Unknown submission error' };
      }

      if (dbError) {
        console.error('Database insert error:', dbError);
        
        // Clean up uploaded file if database insert fails
        try {
          await supabase.storage
            .from('student-recordings')
            .remove([filePath]);
        } catch (cleanupError) {
          console.warn('Failed to cleanup file after db error:', cleanupError);
        }
          
        return { 
          success: false, 
          error: `Database error: ${dbError.message}` 
        };
      }

      console.log('Database record created:', dbData);

      // Generate and save metadata file
      try {
        const { metadata, error: metadataError } = await MetadataService.generateMetadata(
          dbData.id,
          {
            deviceInfo: navigator.userAgent,
            sessionId: `session-${Date.now()}`,
            userAgent: navigator.userAgent
          }
        );

        if (metadata && !metadataError) {
          const { success: metadataSaved, error: saveError } = await MetadataService.saveMetadata(metadata);
          
          if (metadataSaved) {
            console.log('Metadata file created successfully');
          } else {
            console.warn('Failed to save metadata file:', saveError);
          }
        } else {
          console.warn('Failed to generate metadata:', metadataError);
        }
      } catch (metadataError) {
        // Don't fail the upload if metadata creation fails
        console.warn('Error creating metadata file:', metadataError);
      }

      // Process speech analysis in background
      if (metadata.storyText) {
        this.processRecordingAnalysis(dbData.id, audioBlob, metadata.storyText)
          .catch(error => {
            console.error('Background analysis failed for recording', dbData.id, ':', error);
          });
      }

      return { success: true, submissionId: dbData.id };
    } catch (error) {
      console.error('Upload service error:', error);
      return { 
        success: false, 
        error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Process speech analysis for a recording in the background
   */
  private static async processRecordingAnalysis(
    recordingId: string,
    audioBlob: Blob,
    storyText: string
  ): Promise<void> {
    try {
      console.log(`Starting speech analysis for recording ${recordingId}`);
      
      // Update status to processing
      await supabase
        .from('recording_submissions')
        .update({ status: 'processing' })
        .eq('id', recordingId);

      // Analyze the recording
      const analysis = await analyzeRecording(audioBlob, storyText);
      
      // Update the database with analysis results
      const { error: updateError } = await supabase
        .from('recording_submissions')
        .update({ 
          status: 'completed',
          metadata: {
            speech_analysis: analysis,
            analysis_completed_at: new Date().toISOString(),
            analysis_version: '1.0'
          }
        })
        .eq('id', recordingId);

      if (updateError) {
        console.error('Failed to save analysis results:', updateError);
        // Mark as failed if we can't save results
        await supabase
          .from('recording_submissions')
          .update({ status: 'failed' })
          .eq('id', recordingId);
      } else {
        console.log(`Speech analysis completed for recording ${recordingId}`);
      }
    } catch (error) {
      console.error('Speech analysis failed:', error);
      
      // Mark recording as failed
      await supabase
        .from('recording_submissions')
        .update({ status: 'failed' })
        .eq('id', recordingId);
    }
  }

  /**
   * Get recording submissions for a student
   */
  static async getStudentRecordings(
    studentId: string,
    limit: number = 10
  ): Promise<{ recordings: RecordingSubmission[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('recording_submissions')
        .select(`
          id,
          student_id,
          story_id,
          file_path,
          duration,
          submitted_at,
          status,
          metadata
        `)
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recordings:', error);
        return { recordings: [], error: 'Failed to fetch recordings' };
      }

      return { recordings: data || [] };
    } catch (error) {
      console.error('Service error:', error);
      return { recordings: [], error: 'Unexpected error fetching recordings' };
    }
  }

  /**
   * Get recording submissions for a class (teacher view)
   */
  static async getClassRecordings(
    classId: string,
    limit: number = 50
  ): Promise<{ recordings: RecordingSubmission[]; error?: string }> {
    try {
      // Use secure RPC function to get recordings with student names (bypasses RLS issues)
      const { data, error } = await supabase
        .rpc('get_class_recordings_with_students', {
          p_class_id: classId,
          p_limit: limit
        });

      if (error) {
        console.error('Error fetching class recordings via RPC:', error);
        return { recordings: [], error: 'Failed to fetch class recordings' };
      }

      // Transform the RPC result to match our RecordingSubmission interface
      const recordings = (data || []).map((row: any) => ({
        id: row.id,
        student_id: row.student_id,
        story_id: row.story_id,
        file_path: row.file_path,
        duration: row.duration,
        submitted_at: row.submitted_at,
        status: row.status,
        assignment_id: row.assignment_id,
        archived: row.archived,
        metadata: row.metadata,
        // Add student name from RPC result
        student: {
          full_name: row.student_name
        }
      }));

      return { recordings };
    } catch (error) {
      console.error('Service error:', error);
      return { recordings: [], error: 'Unexpected error fetching recordings' };
    }
  }

  /**
   * Get classes for a teacher
   */
  static async getTeacherClasses(
    teacherId: string
  ): Promise<{ classes: Array<{
    id: string;
    name: string;
    grade_level: number;
    student_count: number;
  }>; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          grade_level,
          access_token,
          profiles!classes_teacher_id_fkey(count)
        `)
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching teacher classes:', error);
        return { classes: [], error: 'Failed to fetch classes' };
      }

      // Get student count for each class
      const classesWithCounts = await Promise.all(
        (data || []).map(async (classInfo) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact' })
            .eq('class_id', classInfo.id)
            .eq('role', 'student')
            .eq('is_active', true);

          return {
            id: classInfo.id,
            name: classInfo.name,
            grade_level: classInfo.grade_level,
            access_token: classInfo.access_token,
            student_count: count || 0
          };
        })
      );

      return { classes: classesWithCounts };
    } catch (error) {
      console.error('Service error:', error);
      return { classes: [], error: 'Unexpected error fetching classes' };
    }
  }

  /**
   * Update recording status (for processing pipeline)
   */
  static async updateRecordingStatus(
    submissionId: string,
    status: RecordingSubmission['status'],
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = { status };
      if (metadata) {
        updateData.metadata = metadata;
      }

      const { error } = await supabase
        .from('recording_submissions')
        .update(updateData)
        .eq('id', submissionId);

      if (error) {
        console.error('Error updating recording status:', error);
        return { success: false, error: 'Failed to update recording status' };
      }

      return { success: true };
    } catch (error) {
      console.error('Service error:', error);
      return { success: false, error: 'Unexpected error updating status' };
    }
  }

  /**
   * Get signed URL for downloading recording file
   */
  static async getRecordingUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<{ url?: string; error?: string }> {
    try {
      const { data, error } = await supabase.storage
        .from('student-recordings')
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        console.error('Error creating signed URL:', error);
        return { error: 'Failed to generate download link' };
      }

      return { url: data.signedUrl };
    } catch (error) {
      console.error('Service error:', error);
      return { error: 'Unexpected error generating download link' };
    }
  }

  /**
   * Archive a recording (mark as archived but keep file and record)
   */
  static async archiveRecording(
    submissionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('recording_submissions')
        .update({ archived: true })
        .eq('id', submissionId);

      if (error) {
        console.error('Database archive error:', error);
        return { success: false, error: 'Failed to archive recording' };
      }

      return { success: true };
    } catch (error) {
      console.error('Service error:', error);
      return { success: false, error: 'Unexpected error archiving recording' };
    }
  }

  /**
   * Unarchive a recording
   */
  static async unarchiveRecording(
    submissionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('recording_submissions')
        .update({ archived: false })
        .eq('id', submissionId);

      if (error) {
        console.error('Database unarchive error:', error);
        return { success: false, error: 'Failed to unarchive recording' };
      }

      return { success: true };
    } catch (error) {
      console.error('Service error:', error);
      return { success: false, error: 'Unexpected error unarchiving recording' };
    }
  }

  /**
   * Delete a recording (both file and database record)
   */
  static async deleteRecording(
    submissionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // First get the file path
      const { data: submission, error: fetchError } = await supabase
        .from('recording_submissions')
        .select('file_path')
        .eq('id', submissionId)
        .single();

      if (fetchError) {
        console.error('Error fetching submission:', fetchError);
        return { success: false, error: 'Recording not found' };
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('student-recordings')
        .remove([submission.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('recording_submissions')
        .delete()
        .eq('id', submissionId);

      if (dbError) {
        console.error('Database delete error:', dbError);
        return { success: false, error: 'Failed to delete recording record' };
      }

      return { success: true };
    } catch (error) {
      console.error('Service error:', error);
      return { success: false, error: 'Unexpected error deleting recording' };
    }
  }
}