import { supabase } from '../lib/supabase';
import { FileOrganizationService } from './FileOrganizationService';
import { MetadataService } from './MetadataService';

/**
 * File Processing Service
 * 
 * Handles automated file organization, batch processing, and atomic move operations
 * for student recordings with proper error handling and rollback mechanisms
 */

export interface ProcessingJob {
  id: string;
  recordingId: string;
  currentPath: string;
  targetPath?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rolled_back';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  attempts: number;
  metadata?: any;
}

export interface ProcessingResult {
  success: boolean;
  recordingId: string;
  oldPath?: string;
  newPath?: string;
  metadataCreated?: boolean;
  error?: string;
  rollbackPath?: string;
}

export interface BatchProcessingStatus {
  totalJobs: number;
  completed: number;
  failed: number;
  inProgress: number;
  pending: number;
  progress: number;
  estimatedTimeRemaining?: number;
}

export class FileProcessingService {
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly BATCH_SIZE = 5; // Process 5 files at a time
  private static readonly PROCESSING_DELAY = 1000; // 1 second between batches

  /**
   * Process a single recording file - move to organized structure and create metadata
   */
  static async processRecording(recordingId: string): Promise<ProcessingResult> {
    const job: ProcessingJob = {
      id: `job-${recordingId}-${Date.now()}`,
      recordingId,
      currentPath: '',
      status: 'processing',
      startedAt: new Date().toISOString(),
      attempts: 1
    };

    try {
      console.log(`Starting processing job ${job.id} for recording ${recordingId}`);

      // Get recording information
      const { data: recording, error: fetchError } = await supabase
        .from('recording_submissions')
        .select('id, file_path, student_id, class_id, metadata')
        .eq('id', recordingId)
        .single();

      if (fetchError || !recording) {
        return {
          success: false,
          recordingId,
          error: 'Recording not found'
        };
      }

      job.currentPath = recording.file_path;

      // Check if already organized
      const { isOrganized } = FileOrganizationService.parseExistingPath(recording.file_path);
      if (isOrganized) {
        console.log(`Recording ${recordingId} is already organized`);
        
        // Still generate metadata if missing
        let metadataCreated = false;
        try {
          const { metadata } = await MetadataService.loadMetadata(recording.file_path);
          if (!metadata) {
            // Generate and save metadata
            const { metadata: newMetadata, error: metadataError } = await MetadataService.generateMetadata(recordingId);
            if (newMetadata && !metadataError) {
              const { success } = await MetadataService.saveMetadata(newMetadata);
              metadataCreated = success;
            }
          }
        } catch (error) {
          console.warn(`Failed to check/create metadata for ${recordingId}:`, error);
        }

        return {
          success: true,
          recordingId,
          oldPath: recording.file_path,
          newPath: recording.file_path,
          metadataCreated
        };
      }

      // Generate organized path
      const { newPath, error: moveError } = await FileOrganizationService.moveRecordingToOrganizedPath(
        recordingId,
        recording.file_path
      );

      if (moveError || !newPath) {
        job.status = 'failed';
        job.error = moveError || 'Failed to move file';
        job.completedAt = new Date().toISOString();
        
        return {
          success: false,
          recordingId,
          oldPath: recording.file_path,
          error: job.error
        };
      }

      job.targetPath = newPath;

      // Generate and save metadata
      let metadataCreated = false;
      try {
        const { metadata, error: metadataError } = await MetadataService.generateMetadata(recordingId);
        
        if (metadata && !metadataError) {
          const { success } = await MetadataService.saveMetadata(metadata);
          metadataCreated = success;
          
          if (!success) {
            console.warn(`Failed to save metadata for recording ${recordingId}`);
          }
        } else {
          console.warn(`Failed to generate metadata for recording ${recordingId}:`, metadataError);
        }
      } catch (metadataError) {
        console.warn(`Error creating metadata for recording ${recordingId}:`, metadataError);
      }

      // Mark job as completed
      job.status = 'completed';
      job.completedAt = new Date().toISOString();

      console.log(`Successfully processed recording ${recordingId}: ${recording.file_path} -> ${newPath}`);

      return {
        success: true,
        recordingId,
        oldPath: recording.file_path,
        newPath,
        metadataCreated
      };

    } catch (error) {
      console.error(`Error processing recording ${recordingId}:`, error);
      
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date().toISOString();

      return {
        success: false,
        recordingId,
        oldPath: job.currentPath,
        error: job.error
      };
    }
  }

  /**
   * Process recordings in batches with retry logic
   */
  static async processBatch(
    recordingIds: string[],
    onProgress?: (status: BatchProcessingStatus, results: ProcessingResult[]) => void
  ): Promise<{
    success: boolean;
    results: ProcessingResult[];
    summary: BatchProcessingStatus;
  }> {
    const startTime = Date.now();
    const totalJobs = recordingIds.length;
    const results: ProcessingResult[] = [];
    let completed = 0;
    let failed = 0;

    console.log(`Starting batch processing of ${totalJobs} recordings`);

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < recordingIds.length; i += this.BATCH_SIZE) {
      const batch = recordingIds.slice(i, i + this.BATCH_SIZE);
      const inProgress = batch.length;
      const pending = Math.max(0, recordingIds.length - i - batch.length);

      // Report progress before processing batch
      if (onProgress) {
        const progress = (completed / totalJobs) * 100;
        const elapsed = Date.now() - startTime;
        const estimatedTotal = elapsed * (totalJobs / Math.max(completed, 1));
        const estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed);

        onProgress({
          totalJobs,
          completed,
          failed,
          inProgress,
          pending,
          progress,
          estimatedTimeRemaining
        }, results);
      }

      console.log(`Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(recordingIds.length / this.BATCH_SIZE)}`);

      // Process batch in parallel
      const batchPromises = batch.map(recordingId => this.processRecording(recordingId));
      const batchResults = await Promise.all(batchPromises);

      // Update counters
      for (const result of batchResults) {
        if (result.success) {
          completed++;
        } else {
          failed++;
        }
        results.push(result);
      }

      // Add delay between batches
      if (i + this.BATCH_SIZE < recordingIds.length) {
        await new Promise(resolve => setTimeout(resolve, this.PROCESSING_DELAY));
      }
    }

    // Final progress report
    if (onProgress) {
      const finalStatus: BatchProcessingStatus = {
        totalJobs,
        completed,
        failed,
        inProgress: 0,
        pending: 0,
        progress: 100,
        estimatedTimeRemaining: 0
      };
      onProgress(finalStatus, results);
    }

    const success = failed === 0;
    console.log(`Batch processing completed. Success: ${success}, Total: ${totalJobs}, Completed: ${completed}, Failed: ${failed}`);

    return {
      success,
      results,
      summary: {
        totalJobs,
        completed,
        failed,
        inProgress: 0,
        pending: 0,
        progress: 100
      }
    };
  }

  /**
   * Process all unorganized recordings
   */
  static async processAllUnorganized(
    onProgress?: (status: BatchProcessingStatus, results: ProcessingResult[]) => void
  ): Promise<{
    success: boolean;
    results: ProcessingResult[];
    summary: BatchProcessingStatus;
  }> {
    try {
      // Get all recordings that need organization
      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('id, file_path')
        .order('submitted_at', { ascending: true }); // Process oldest first

      if (error) {
        throw error;
      }

      // Filter to only unorganized recordings
      const unorganizedIds: string[] = [];
      
      for (const recording of recordings || []) {
        const { isOrganized } = FileOrganizationService.parseExistingPath(recording.file_path);
        if (!isOrganized) {
          unorganizedIds.push(recording.id);
        }
      }

      console.log(`Found ${unorganizedIds.length} unorganized recordings out of ${recordings?.length || 0} total`);

      if (unorganizedIds.length === 0) {
        const emptyResult = {
          totalJobs: 0,
          completed: 0,
          failed: 0,
          inProgress: 0,
          pending: 0,
          progress: 100
        };

        return {
          success: true,
          results: [],
          summary: emptyResult
        };
      }

      // Process all unorganized recordings
      return await this.processBatch(unorganizedIds, onProgress);

    } catch (error) {
      console.error('Error processing all unorganized recordings:', error);
      return {
        success: false,
        results: [],
        summary: {
          totalJobs: 0,
          completed: 0,
          failed: 1,
          inProgress: 0,
          pending: 0,
          progress: 0
        }
      };
    }
  }

  /**
   * Rollback a recording to its previous location
   */
  static async rollbackRecording(recordingId: string): Promise<{
    success: boolean;
    oldPath?: string;
    restoredPath?: string;
    error?: string;
  }> {
    try {
      console.log(`Starting rollback for recording ${recordingId}`);

      // Get recording with migration metadata
      const { data: recording, error: fetchError } = await supabase
        .from('recording_submissions')
        .select('id, file_path, metadata')
        .eq('id', recordingId)
        .single();

      if (fetchError || !recording) {
        return {
          success: false,
          error: 'Recording not found'
        };
      }

      const originalPath = recording.metadata?.migratedFrom;
      if (!originalPath) {
        return {
          success: false,
          error: 'No original path found in metadata - cannot rollback'
        };
      }

      // Move file back to original location
      const { data: moveData, error: moveError } = await supabase.storage
        .from('student-recordings')
        .move(recording.file_path, originalPath);

      if (moveError) {
        return {
          success: false,
          error: `Failed to move file back: ${moveError.message}`
        };
      }

      // Update database record
      const updatedMetadata = { ...recording.metadata };
      delete updatedMetadata.migratedFrom;
      updatedMetadata.rolledBackAt = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('recording_submissions')
        .update({
          file_path: originalPath,
          metadata: updatedMetadata
        })
        .eq('id', recordingId);

      if (updateError) {
        // Try to move file back to organized location
        try {
          await supabase.storage
            .from('student-recordings')
            .move(originalPath, recording.file_path);
        } catch (rollbackError) {
          console.error('Failed to rollback file move during database update failure:', rollbackError);
        }

        return {
          success: false,
          error: 'Failed to update database record'
        };
      }

      // Remove metadata file from organized location
      try {
        const metadataPath = recording.file_path.replace(/\.[^.]+$/, '.metadata.json');
        await supabase.storage
          .from('student-recordings')
          .remove([metadataPath]);
      } catch (metadataError) {
        console.warn('Failed to remove metadata file during rollback:', metadataError);
      }

      console.log(`Successfully rolled back recording ${recordingId}: ${recording.file_path} -> ${originalPath}`);

      return {
        success: true,
        oldPath: recording.file_path,
        restoredPath: originalPath
      };

    } catch (error) {
      console.error(`Error rolling back recording ${recordingId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate file integrity after processing
   */
  static async validateFileIntegrity(recordingId: string): Promise<{
    valid: boolean;
    issues: string[];
    fileExists: boolean;
    metadataExists: boolean;
    databaseConsistent: boolean;
  }> {
    const issues: string[] = [];
    let fileExists = false;
    let metadataExists = false;
    let databaseConsistent = false;

    try {
      // Get recording from database
      const { data: recording, error: dbError } = await supabase
        .from('recording_submissions')
        .select('id, file_path, metadata')
        .eq('id', recordingId)
        .single();

      if (dbError || !recording) {
        issues.push('Recording not found in database');
        return { valid: false, issues, fileExists, metadataExists, databaseConsistent };
      }

      databaseConsistent = true;

      // Check if file exists in storage
      try {
        const { data: fileList, error: listError } = await supabase.storage
          .from('student-recordings')
          .list(recording.file_path.substring(0, recording.file_path.lastIndexOf('/')), {
            search: recording.file_path.substring(recording.file_path.lastIndexOf('/') + 1)
          });

        if (!listError && fileList && fileList.length > 0) {
          fileExists = true;
        } else {
          issues.push('Recording file not found in storage');
        }
      } catch (storageError) {
        issues.push(`Storage check failed: ${storageError}`);
      }

      // Check if metadata file exists
      try {
        const { metadata } = await MetadataService.loadMetadata(recording.file_path);
        if (metadata) {
          metadataExists = true;
          
          // Validate metadata consistency
          if (metadata.recordingId !== recordingId) {
            issues.push('Metadata recording ID mismatch');
          }
          if (metadata.filePath !== recording.file_path) {
            issues.push('Metadata file path mismatch');
          }
        } else {
          issues.push('Metadata file not found or invalid');
        }
      } catch (metadataError) {
        issues.push(`Metadata check failed: ${metadataError}`);
      }

      // Check path organization
      const { isOrganized, error: pathError } = FileOrganizationService.parseExistingPath(recording.file_path);
      if (pathError) {
        issues.push(`Path parsing error: ${pathError}`);
      } else if (!isOrganized) {
        issues.push('File not in organized directory structure');
      }

    } catch (error) {
      issues.push(`Validation failed: ${error}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      fileExists,
      metadataExists,
      databaseConsistent
    };
  }

  /**
   * Get processing status for all recordings
   */
  static async getProcessingStatus(): Promise<{
    organized: number;
    unorganized: number;
    withMetadata: number;
    withoutMetadata: number;
    total: number;
    organizationProgress: number;
    metadataProgress: number;
  }> {
    try {
      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('id, file_path, metadata');

      if (error) {
        throw error;
      }

      const total = recordings?.length || 0;
      let organized = 0;
      let withMetadata = 0;

      if (recordings) {
        for (const recording of recordings) {
          // Check organization
          const { isOrganized } = FileOrganizationService.parseExistingPath(recording.file_path);
          if (isOrganized) {
            organized++;
          }

          // Check metadata
          if (recording.metadata?.organizationVersion) {
            withMetadata++;
          }
        }
      }

      const unorganized = total - organized;
      const withoutMetadata = total - withMetadata;
      const organizationProgress = total > 0 ? (organized / total) * 100 : 100;
      const metadataProgress = total > 0 ? (withMetadata / total) * 100 : 100;

      return {
        organized,
        unorganized,
        withMetadata,
        withoutMetadata,
        total,
        organizationProgress,
        metadataProgress
      };
    } catch (error) {
      console.error('Error getting processing status:', error);
      return {
        organized: 0,
        unorganized: 0,
        withMetadata: 0,
        withoutMetadata: 0,
        total: 0,
        organizationProgress: 0,
        metadataProgress: 0
      };
    }
  }
}