import { supabase } from '../lib/supabase';
import { FileOrganizationService } from './FileOrganizationService';

/**
 * Storage Migration Service
 * 
 * Handles migration of existing recordings to the new organized directory structure
 */

export interface MigrationStatus {
  totalRecordings: number;
  organizedRecordings: number;
  migratedRecordings: number;
  failedMigrations: number;
  progress: number;
}

export interface MigrationResult {
  success: boolean;
  recordingId: string;
  oldPath?: string;
  newPath?: string;
  error?: string;
}

export class StorageMigrationService {
  /**
   * Check the current organization status of all recordings
   */
  static async getMigrationStatus(): Promise<MigrationStatus> {
    try {
      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('id, file_path, metadata');

      if (error) {
        throw error;
      }

      const totalRecordings = recordings?.length || 0;
      let organizedRecordings = 0;
      let migratedRecordings = 0;

      if (recordings) {
        for (const recording of recordings) {
          const { isOrganized } = FileOrganizationService.parseExistingPath(recording.file_path);
          
          if (isOrganized) {
            organizedRecordings++;
            
            // Check if this was migrated (has organizationVersion in metadata)
            if (recording.metadata?.organizationVersion) {
              migratedRecordings++;
            }
          }
        }
      }

      const progress = totalRecordings > 0 ? (organizedRecordings / totalRecordings) * 100 : 100;

      return {
        totalRecordings,
        organizedRecordings,
        migratedRecordings,
        failedMigrations: 0, // Will be calculated during actual migration
        progress
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return {
        totalRecordings: 0,
        organizedRecordings: 0,
        migratedRecordings: 0,
        failedMigrations: 0,
        progress: 0
      };
    }
  }

  /**
   * Get list of recordings that need migration
   */
  static async getUnorganizedRecordings(): Promise<{
    recordings: Array<{
      id: string;
      file_path: string;
      student_id: string;
      class_id: string;
      submitted_at: string;
    }>;
    error?: string;
  }> {
    try {
      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('id, file_path, student_id, class_id, submitted_at')
        .order('submitted_at', { ascending: true }); // Process oldest first

      if (error) {
        throw error;
      }

      // Filter to only unorganized recordings
      const unorganized = recordings?.filter(recording => {
        const { isOrganized } = FileOrganizationService.parseExistingPath(recording.file_path);
        return !isOrganized;
      }) || [];

      return { recordings: unorganized };
    } catch (error) {
      console.error('Error fetching unorganized recordings:', error);
      return {
        recordings: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Migrate a single recording to organized structure
   */
  static async migrateRecording(recordingId: string): Promise<MigrationResult> {
    try {
      // Get recording details
      const { data: recording, error: fetchError } = await supabase
        .from('recording_submissions')
        .select('id, file_path, student_id, class_id')
        .eq('id', recordingId)
        .single();

      if (fetchError || !recording) {
        return {
          success: false,
          recordingId,
          error: 'Recording not found'
        };
      }

      // Check if already organized
      const { isOrganized } = FileOrganizationService.parseExistingPath(recording.file_path);
      if (isOrganized) {
        return {
          success: true,
          recordingId,
          oldPath: recording.file_path,
          newPath: recording.file_path,
          error: 'Already organized'
        };
      }

      // Migrate the recording
      const { success, newPath, error } = await FileOrganizationService.moveRecordingToOrganizedPath(
        recordingId,
        recording.file_path
      );

      return {
        success,
        recordingId,
        oldPath: recording.file_path,
        newPath,
        error
      };
    } catch (error) {
      console.error(`Error migrating recording ${recordingId}:`, error);
      return {
        success: false,
        recordingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Migrate all unorganized recordings in batches
   */
  static async migrateAllRecordings(
    batchSize: number = 10,
    onProgress?: (status: MigrationStatus, results: MigrationResult[]) => void
  ): Promise<{
    success: boolean;
    results: MigrationResult[];
    finalStatus: MigrationStatus;
    error?: string;
  }> {
    try {
      const { recordings, error: fetchError } = await this.getUnorganizedRecordings();
      
      if (fetchError) {
        return {
          success: false,
          results: [],
          finalStatus: await this.getMigrationStatus(),
          error: fetchError
        };
      }

      const allResults: MigrationResult[] = [];
      let failedMigrations = 0;

      console.log(`Starting migration of ${recordings.length} recordings in batches of ${batchSize}`);

      // Process recordings in batches
      for (let i = 0; i < recordings.length; i += batchSize) {
        const batch = recordings.slice(i, i + batchSize);
        
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(recordings.length / batchSize)}`);

        // Process batch in parallel
        const batchPromises = batch.map(recording => this.migrateRecording(recording.id));
        const batchResults = await Promise.all(batchPromises);
        
        // Count failures in this batch
        const batchFailures = batchResults.filter(result => !result.success).length;
        failedMigrations += batchFailures;
        
        allResults.push(...batchResults);

        // Report progress
        if (onProgress) {
          const currentStatus = await this.getMigrationStatus();
          currentStatus.failedMigrations = failedMigrations;
          onProgress(currentStatus, batchResults);
        }

        // Add delay between batches to avoid overwhelming the storage system
        if (i + batchSize < recordings.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const finalStatus = await this.getMigrationStatus();
      finalStatus.failedMigrations = failedMigrations;

      const overallSuccess = failedMigrations === 0;
      
      console.log(`Migration completed. Success: ${overallSuccess}, Total: ${recordings.length}, Failed: ${failedMigrations}`);

      return {
        success: overallSuccess,
        results: allResults,
        finalStatus,
        error: failedMigrations > 0 ? `${failedMigrations} recordings failed to migrate` : undefined
      };
    } catch (error) {
      console.error('Error during batch migration:', error);
      return {
        success: false,
        results: [],
        finalStatus: await this.getMigrationStatus(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate organization integrity of all recordings
   */
  static async validateOrganization(): Promise<{
    valid: boolean;
    issues: Array<{
      recordingId: string;
      issue: string;
      filePath: string;
    }>;
    totalChecked: number;
  }> {
    try {
      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('id, file_path, student_id, class_id, metadata');

      if (error) {
        throw error;
      }

      const issues: Array<{ recordingId: string; issue: string; filePath: string }> = [];
      const totalChecked = recordings?.length || 0;

      if (recordings) {
        for (const recording of recordings) {
          // Check if path is organized
          const { isOrganized, error: parseError } = FileOrganizationService.parseExistingPath(recording.file_path);
          
          if (parseError) {
            issues.push({
              recordingId: recording.id,
              issue: `Path parsing error: ${parseError}`,
              filePath: recording.file_path
            });
            continue;
          }

          if (!isOrganized) {
            issues.push({
              recordingId: recording.id,
              issue: 'File not in organized structure',
              filePath: recording.file_path
            });
            continue;
          }

          // Check if metadata is consistent with path
          if (!recording.metadata?.organizationVersion) {
            issues.push({
              recordingId: recording.id,
              issue: 'Missing organization version in metadata',
              filePath: recording.file_path
            });
          }

          // Verify file exists in storage
          try {
            const { data: fileExists, error: checkError } = await supabase.storage
              .from('student-recordings')
              .list(recording.file_path.substring(0, recording.file_path.lastIndexOf('/')), {
                search: recording.file_path.substring(recording.file_path.lastIndexOf('/') + 1)
              });

            if (checkError || !fileExists || fileExists.length === 0) {
              issues.push({
                recordingId: recording.id,
                issue: 'File not found in storage',
                filePath: recording.file_path
              });
            }
          } catch (storageError) {
            issues.push({
              recordingId: recording.id,
              issue: `Storage check failed: ${storageError}`,
              filePath: recording.file_path
            });
          }
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        totalChecked
      };
    } catch (error) {
      console.error('Error validating organization:', error);
      return {
        valid: false,
        issues: [],
        totalChecked: 0
      };
    }
  }

  /**
   * Clean up orphaned files (files in storage without database records)
   */
  static async cleanupOrphanedFiles(): Promise<{
    cleaned: number;
    orphanedFiles: string[];
    error?: string;
  }> {
    try {
      // Get all files from storage
      const { data: allFiles, error: listError } = await supabase.storage
        .from('student-recordings')
        .list('recordings', { recursive: true });

      if (listError) {
        throw listError;
      }

      // Get all file paths from database
      const { data: dbRecordings, error: dbError } = await supabase
        .from('recording_submissions')
        .select('file_path');

      if (dbError) {
        throw dbError;
      }

      const dbPaths = new Set(dbRecordings?.map(r => r.file_path) || []);
      
      // Find orphaned files
      const orphanedFiles: string[] = [];
      
      if (allFiles) {
        for (const file of allFiles) {
          if (file.name && file.name !== '.emptyFolderPlaceholder') {
            const fullPath = `recordings/${file.name}`;
            if (!dbPaths.has(fullPath)) {
              orphanedFiles.push(fullPath);
            }
          }
        }
      }

      console.log(`Found ${orphanedFiles.length} orphaned files`);

      // For safety, only log orphaned files, don't automatically delete
      // In a production environment, you might want to move them to a quarantine folder
      return {
        cleaned: 0, // No automatic cleanup for safety
        orphanedFiles
      };
    } catch (error) {
      console.error('Error cleaning up orphaned files:', error);
      return {
        cleaned: 0,
        orphanedFiles: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}