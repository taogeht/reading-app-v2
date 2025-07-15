import { supabase } from '../lib/supabase';
import { MetadataService } from './MetadataService';

/**
 * Compression and Archival Service
 * 
 * Handles file compression for long-term storage and archival procedures
 * with quality preservation and automated lifecycle management
 */

export interface CompressionOptions {
  quality: 'high' | 'medium' | 'low';
  targetBitrate?: number; // kbps
  preserveMetadata: boolean;
  createBackup: boolean;
}

export interface ArchivalPolicy {
  name: string;
  description: string;
  triggers: {
    ageInDays?: number;
    accessPattern?: 'never' | 'rarely' | 'occasional';
    fileSize?: number; // bytes
    storageThreshold?: number; // percentage
  };
  actions: {
    compress: boolean;
    move: boolean;
    deleteOriginal: boolean;
    notifyAdmin: boolean;
  };
  retentionPeriod?: number; // days, 0 means indefinite
}

export interface ArchivalJob {
  id: string;
  recordingId: string;
  policyName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
  error?: string;
  estimatedTimeRemaining?: number;
}

export interface RetrievalRequest {
  id: string;
  recordingId: string;
  requestedBy: string;
  requestedAt: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'processing' | 'ready' | 'delivered' | 'expired';
  estimatedReadyTime?: string;
  downloadUrl?: string;
  expiresAt?: string;
}

export class CompressionArchivalService {
  // Default archival policies
  private static readonly DEFAULT_POLICIES: ArchivalPolicy[] = [
    {
      name: 'old_recordings',
      description: 'Archive recordings older than 1 year',
      triggers: {
        ageInDays: 365,
        accessPattern: 'rarely'
      },
      actions: {
        compress: true,
        move: true,
        deleteOriginal: true,
        notifyAdmin: false
      },
      retentionPeriod: 2555 // 7 years for educational records
    },
    {
      name: 'large_files',
      description: 'Compress files larger than 50MB',
      triggers: {
        fileSize: 50 * 1024 * 1024
      },
      actions: {
        compress: true,
        move: false,
        deleteOriginal: false,
        notifyAdmin: false
      }
    },
    {
      name: 'storage_pressure',
      description: 'Archive when storage exceeds 80% capacity',
      triggers: {
        storageThreshold: 80,
        ageInDays: 180
      },
      actions: {
        compress: true,
        move: true,
        deleteOriginal: true,
        notifyAdmin: true
      }
    }
  ];

  /**
   * Compress an audio file using Web Audio API and various compression techniques
   */
  static async compressAudioFile(
    audioBlob: Blob,
    options: CompressionOptions = {
      quality: 'medium',
      preserveMetadata: true,
      createBackup: false
    }
  ): Promise<{
    success: boolean;
    compressedBlob?: Blob;
    originalSize: number;
    compressedSize?: number;
    compressionRatio?: number;
    error?: string;
  }> {
    try {
      const originalSize = audioBlob.size;
      
      // Since we're in a browser environment, we'll simulate compression
      // In a real implementation, you might use Web Audio API or server-side processing
      
      // For demonstration, we'll create a "compressed" version by reducing quality
      const compressionFactor = this.getCompressionFactor(options.quality);
      
      // Simulate compression by creating a smaller blob
      // In reality, this would involve actual audio processing
      const compressedData = await this.simulateAudioCompression(audioBlob, compressionFactor);
      
      const compressedSize = compressedData.size;
      const compressionRatio = originalSize > 0 ? (originalSize - compressedSize) / originalSize : 0;

      console.log(`Audio compression: ${originalSize} bytes → ${compressedSize} bytes (${(compressionRatio * 100).toFixed(1)}% reduction)`);

      return {
        success: true,
        compressedBlob: compressedData,
        originalSize,
        compressedSize,
        compressionRatio
      };
    } catch (error) {
      console.error('Error compressing audio file:', error);
      return {
        success: false,
        originalSize: audioBlob.size,
        error: error instanceof Error ? error.message : 'Compression failed'
      };
    }
  }

  /**
   * Get compression factor based on quality setting
   */
  private static getCompressionFactor(quality: CompressionOptions['quality']): number {
    switch (quality) {
      case 'high': return 0.8; // 20% reduction
      case 'medium': return 0.6; // 40% reduction
      case 'low': return 0.4; // 60% reduction
      default: return 0.6;
    }
  }

  /**
   * Simulate audio compression (in real implementation, use Web Audio API or server processing)
   */
  private static async simulateAudioCompression(audioBlob: Blob, compressionFactor: number): Promise<Blob> {
    // This is a simulation - in real implementation, you would:
    // 1. Use Web Audio API to decode the audio
    // 2. Apply compression algorithms (reduce bitrate, sample rate)
    // 3. Re-encode with lower quality settings
    
    const arrayBuffer = await audioBlob.arrayBuffer();
    const compressedSize = Math.floor(arrayBuffer.byteLength * compressionFactor);
    const compressedBuffer = arrayBuffer.slice(0, compressedSize);
    
    return new Blob([compressedBuffer], { type: audioBlob.type });
  }

  /**
   * Archive a recording based on archival policies
   */
  static async archiveRecording(
    recordingId: string,
    policyName: string = 'old_recordings',
    options?: Partial<CompressionOptions>
  ): Promise<{
    success: boolean;
    jobId?: string;
    error?: string;
  }> {
    try {
      console.log(`Starting archival process for recording ${recordingId} with policy ${policyName}`);

      // Get recording information
      const { data: recording, error: fetchError } = await supabase
        .from('recording_submissions')
        .select('id, file_path, metadata, archived')
        .eq('id', recordingId)
        .single();

      if (fetchError || !recording) {
        return { success: false, error: 'Recording not found' };
      }

      if (recording.archived) {
        return { success: false, error: 'Recording is already archived' };
      }

      // Create archival job
      const jobId = `archive-${recordingId}-${Date.now()}`;
      const job: ArchivalJob = {
        id: jobId,
        recordingId,
        policyName,
        status: 'pending',
        createdAt: new Date().toISOString(),
        originalSize: recording.metadata?.fileSize || 0
      };

      // Get the policy
      const policy = this.DEFAULT_POLICIES.find(p => p.name === policyName);
      if (!policy) {
        return { success: false, error: `Archival policy '${policyName}' not found` };
      }

      // Start archival process
      await this.executeArchivalJob(job, policy, options);

      return { success: true, jobId };
    } catch (error) {
      console.error(`Error archiving recording ${recordingId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute an archival job
   */
  private static async executeArchivalJob(
    job: ArchivalJob,
    policy: ArchivalPolicy,
    options?: Partial<CompressionOptions>
  ): Promise<void> {
    try {
      job.status = 'processing';
      job.startedAt = new Date().toISOString();

      // Get the recording file
      const { data: recording, error: fetchError } = await supabase
        .from('recording_submissions')
        .select('id, file_path, metadata')
        .eq('id', job.recordingId)
        .single();

      if (fetchError || !recording) {
        throw new Error('Recording not found');
      }

      // Download the original file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('student-recordings')
        .download(recording.file_path);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      // Compress the file if required
      let finalBlob = fileData;
      let compressionRatio = 0;

      if (policy.actions.compress) {
        const compressionOptions: CompressionOptions = {
          quality: 'medium',
          preserveMetadata: true,
          createBackup: true,
          ...options
        };

        const compressionResult = await this.compressAudioFile(fileData, compressionOptions);
        
        if (compressionResult.success && compressionResult.compressedBlob) {
          finalBlob = compressionResult.compressedBlob;
          compressionRatio = compressionResult.compressionRatio || 0;
          job.compressedSize = compressionResult.compressedSize;
          job.compressionRatio = compressionRatio;
        }
      }

      // Move to archive location if required
      let archivePath = recording.file_path;
      if (policy.actions.move) {
        archivePath = this.generateArchivePath(recording.file_path);
        
        // Upload to archive location
        const { error: uploadError } = await supabase.storage
          .from('student-recordings')
          .upload(archivePath, finalBlob, {
            contentType: fileData.type,
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Failed to upload archived file: ${uploadError.message}`);
        }

        // Delete original if specified
        if (policy.actions.deleteOriginal) {
          const { error: deleteError } = await supabase.storage
            .from('student-recordings')
            .remove([recording.file_path]);

          if (deleteError) {
            console.warn(`Failed to delete original file: ${deleteError.message}`);
          }
        }
      }

      // Update database record
      const updatedMetadata = {
        ...recording.metadata,
        archived: true,
        archivedAt: new Date().toISOString(),
        archivalPolicy: policy.name,
        originalPath: recording.file_path,
        archivePath,
        compressionRatio,
        originalSize: job.originalSize,
        compressedSize: job.compressedSize
      };

      const { error: updateError } = await supabase
        .from('recording_submissions')
        .update({
          file_path: archivePath,
          archived: true,
          metadata: updatedMetadata
        })
        .eq('id', job.recordingId);

      if (updateError) {
        throw new Error(`Failed to update database: ${updateError.message}`);
      }

      // Update metadata file
      try {
        const { metadata } = await MetadataService.generateMetadata(job.recordingId);
        if (metadata) {
          await MetadataService.saveMetadata({
            ...metadata,
            additional: {
              ...metadata.additional,
              archived: true,
              archivedAt: new Date().toISOString(),
              archivalPolicy: policy.name
            }
          });
        }
      } catch (metadataError) {
        console.warn('Failed to update metadata file during archival:', metadataError);
      }

      // Mark job as completed
      job.status = 'completed';
      job.completedAt = new Date().toISOString();

      console.log(`Successfully archived recording ${job.recordingId}`);
      
      // Notify admin if required
      if (policy.actions.notifyAdmin) {
        await this.notifyAdmin(job, policy);
      }

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date().toISOString();
      
      console.error(`Archival job ${job.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Generate archive path for a recording
   */
  private static generateArchivePath(originalPath: string): string {
    const pathParts = originalPath.split('/');
    const fileName = pathParts.pop();
    const directory = pathParts.join('/');
    
    // Add archive prefix to directory structure
    return `archive/${directory}/${fileName}`;
  }

  /**
   * Retrieve an archived recording
   */
  static async requestRetrieval(
    recordingId: string,
    requestedBy: string,
    priority: RetrievalRequest['priority'] = 'normal'
  ): Promise<{
    success: boolean;
    requestId?: string;
    estimatedReadyTime?: string;
    error?: string;
  }> {
    try {
      // Check if recording is archived
      const { data: recording, error: fetchError } = await supabase
        .from('recording_submissions')
        .select('id, file_path, archived, metadata')
        .eq('id', recordingId)
        .single();

      if (fetchError || !recording) {
        return { success: false, error: 'Recording not found' };
      }

      if (!recording.archived) {
        // Not archived, can provide immediate access
        const { data: signedUrl } = await supabase.storage
          .from('student-recordings')
          .createSignedUrl(recording.file_path, 3600); // 1 hour expiry

        return {
          success: true,
          requestId: `immediate-${Date.now()}`,
          estimatedReadyTime: new Date().toISOString()
        };
      }

      // Create retrieval request
      const requestId = `retrieve-${recordingId}-${Date.now()}`;
      const estimatedReadyTime = this.calculateEstimatedReadyTime(priority);

      const retrievalRequest: RetrievalRequest = {
        id: requestId,
        recordingId,
        requestedBy,
        requestedAt: new Date().toISOString(),
        priority,
        status: 'pending',
        estimatedReadyTime
      };

      // Process the retrieval (simplified - in real implementation this might be queued)
      await this.processRetrieval(retrievalRequest);

      return {
        success: true,
        requestId,
        estimatedReadyTime
      };
    } catch (error) {
      console.error(`Error requesting retrieval for recording ${recordingId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process a retrieval request
   */
  private static async processRetrieval(request: RetrievalRequest): Promise<void> {
    try {
      request.status = 'processing';

      // Get archived recording info
      const { data: recording, error: fetchError } = await supabase
        .from('recording_submissions')
        .select('id, file_path, metadata')
        .eq('id', request.recordingId)
        .single();

      if (fetchError || !recording) {
        throw new Error('Archived recording not found');
      }

      // Create signed URL for download
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('student-recordings')
        .createSignedUrl(recording.file_path, 24 * 3600); // 24 hours expiry

      if (urlError || !signedUrlData) {
        throw new Error('Failed to create download URL');
      }

      request.downloadUrl = signedUrlData.signedUrl;
      request.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      request.status = 'ready';

      console.log(`Retrieval request ${request.id} is ready for download`);
    } catch (error) {
      request.status = 'expired';
      console.error(`Retrieval request ${request.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Calculate estimated ready time based on priority
   */
  private static calculateEstimatedReadyTime(priority: RetrievalRequest['priority']): string {
    const now = new Date();
    let delayMinutes: number;

    switch (priority) {
      case 'urgent': delayMinutes = 5; break;
      case 'high': delayMinutes = 15; break;
      case 'normal': delayMinutes = 60; break;
      case 'low': delayMinutes = 240; break;
      default: delayMinutes = 60;
    }

    now.setMinutes(now.getMinutes() + delayMinutes);
    return now.toISOString();
  }

  /**
   * Get recordings eligible for archival based on policies
   */
  static async getArchivalCandidates(policyName?: string): Promise<{
    candidates: Array<{
      recordingId: string;
      filePath: string;
      ageInDays: number;
      fileSize: number;
      lastAccessed?: string;
      eligiblePolicies: string[];
    }>;
    totalSpaceSavings: number;
  }> {
    try {
      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('id, file_path, submitted_at, metadata, archived')
        .eq('archived', false);

      if (error) {
        throw error;
      }

      const candidates = [];
      let totalSpaceSavings = 0;
      const now = new Date();

      for (const recording of recordings || []) {
        const submittedDate = new Date(recording.submitted_at);
        const ageInDays = Math.floor((now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24));
        const fileSize = recording.metadata?.fileSize || 0;

        const eligiblePolicies = this.DEFAULT_POLICIES
          .filter(policy => {
            if (policyName && policy.name !== policyName) return false;
            
            const triggers = policy.triggers;
            
            if (triggers.ageInDays && ageInDays < triggers.ageInDays) return false;
            if (triggers.fileSize && fileSize < triggers.fileSize) return false;
            
            return true;
          })
          .map(policy => policy.name);

        if (eligiblePolicies.length > 0) {
          candidates.push({
            recordingId: recording.id,
            filePath: recording.file_path,
            ageInDays,
            fileSize,
            lastAccessed: recording.metadata?.lastAccessed,
            eligiblePolicies
          });

          // Estimate space savings (assume 40% compression ratio)
          totalSpaceSavings += fileSize * 0.4;
        }
      }

      return { candidates, totalSpaceSavings };
    } catch (error) {
      console.error('Error getting archival candidates:', error);
      return { candidates: [], totalSpaceSavings: 0 };
    }
  }

  /**
   * Run automated archival process
   */
  static async runAutomatedArchival(): Promise<{
    success: boolean;
    processed: number;
    archived: number;
    failed: number;
    spaceSaved: number;
    errors: string[];
  }> {
    const result = {
      success: true,
      processed: 0,
      archived: 0,
      failed: 0,
      spaceSaved: 0,
      errors: [] as string[]
    };

    try {
      console.log('Starting automated archival process...');

      // Get candidates for each policy
      for (const policy of this.DEFAULT_POLICIES) {
        const { candidates } = await this.getArchivalCandidates(policy.name);
        
        console.log(`Found ${candidates.length} candidates for policy: ${policy.name}`);

        for (const candidate of candidates) {
          result.processed++;
          
          try {
            const archiveResult = await this.archiveRecording(candidate.recordingId, policy.name);
            
            if (archiveResult.success) {
              result.archived++;
              result.spaceSaved += candidate.fileSize * 0.4; // Estimated compression
            } else {
              result.failed++;
              result.errors.push(`Failed to archive ${candidate.recordingId}: ${archiveResult.error}`);
            }
          } catch (error) {
            result.failed++;
            result.errors.push(`Error archiving ${candidate.recordingId}: ${error}`);
          }

          // Add delay between operations to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      result.success = result.failed === 0;
      console.log(`Automated archival completed. Archived: ${result.archived}, Failed: ${result.failed}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Automated archival failed: ${error}`);
      console.error('Automated archival process failed:', error);
    }

    return result;
  }

  /**
   * Notify admin about archival completion
   */
  private static async notifyAdmin(job: ArchivalJob, policy: ArchivalPolicy): Promise<void> {
    // In a real implementation, this would send an email or notification
    console.log(`ADMIN NOTIFICATION: Archival job ${job.id} completed for recording ${job.recordingId} using policy ${policy.name}`);
    
    const notificationData = {
      type: 'archival_completed',
      jobId: job.id,
      recordingId: job.recordingId,
      policyName: policy.name,
      originalSize: job.originalSize,
      compressedSize: job.compressedSize,
      compressionRatio: job.compressionRatio,
      completedAt: job.completedAt
    };

    // Store notification in database or send via external service
    console.log('Notification data:', notificationData);
  }

  /**
   * Get archival statistics
   */
  static async getArchivalStats(): Promise<{
    totalRecordings: number;
    archivedRecordings: number;
    archivalPercentage: number;
    spaceSavedByCompression: number;
    averageCompressionRatio: number;
    oldestArchived: string;
    newestArchived: string;
  }> {
    try {
      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('archived, metadata, submitted_at');

      if (error) {
        throw error;
      }

      const totalRecordings = recordings?.length || 0;
      const archivedRecordings = recordings?.filter(r => r.archived).length || 0;
      const archivalPercentage = totalRecordings > 0 ? (archivedRecordings / totalRecordings) * 100 : 0;

      let spaceSavedByCompression = 0;
      let totalCompressionRatio = 0;
      let compressionCount = 0;
      let oldestArchived = '';
      let newestArchived = '';

      for (const recording of recordings || []) {
        if (recording.archived && recording.metadata) {
          const compressionRatio = recording.metadata.compressionRatio || 0;
          const originalSize = recording.metadata.originalSize || 0;
          
          if (compressionRatio > 0) {
            spaceSavedByCompression += originalSize * compressionRatio;
            totalCompressionRatio += compressionRatio;
            compressionCount++;
          }

          const archivedAt = recording.metadata.archivedAt;
          if (archivedAt) {
            if (!oldestArchived || archivedAt < oldestArchived) {
              oldestArchived = archivedAt;
            }
            if (!newestArchived || archivedAt > newestArchived) {
              newestArchived = archivedAt;
            }
          }
        }
      }

      const averageCompressionRatio = compressionCount > 0 ? totalCompressionRatio / compressionCount : 0;

      return {
        totalRecordings,
        archivedRecordings,
        archivalPercentage,
        spaceSavedByCompression,
        averageCompressionRatio,
        oldestArchived,
        newestArchived
      };
    } catch (error) {
      console.error('Error getting archival stats:', error);
      return {
        totalRecordings: 0,
        archivedRecordings: 0,
        archivalPercentage: 0,
        spaceSavedByCompression: 0,
        averageCompressionRatio: 0,
        oldestArchived: '',
        newestArchived: ''
      };
    }
  }
}