import { supabase } from '../lib/supabase';
import { FileOrganizationService } from './FileOrganizationService';

/**
 * Storage Monitoring Service
 * 
 * Provides comprehensive storage monitoring, capacity management, and usage analytics
 * with automated alerts and cleanup suggestions
 */

export interface StorageStats {
  totalFiles: number;
  totalSize: number; // in bytes
  averageFileSize: number;
  largestFile: {
    path: string;
    size: number;
  };
  oldestFile: {
    path: string;
    date: string;
  };
  newestFile: {
    path: string;
    date: string;
  };
  lastUpdated: string;
}

export interface UsageByCategory {
  category: string;
  fileCount: number;
  totalSize: number;
  averageSize: number;
  percentage: number;
}

export interface UsageAnalytics {
  bySchoolYear: UsageByCategory[];
  byGrade: UsageByCategory[];
  byClass: UsageByCategory[];
  byMonth: UsageByCategory[];
  byFileType: UsageByCategory[];
  overallStats: StorageStats;
  trends: {
    dailyGrowth: number; // bytes per day
    weeklyGrowth: number;
    monthlyGrowth: number;
    projectedMonthlyGrowth: number;
  };
}

export interface StorageAlert {
  id: string;
  type: 'capacity' | 'growth_rate' | 'old_files' | 'large_files' | 'orphaned_files';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  createdAt: string;
  acknowledged: boolean;
  actionRequired: boolean;
  suggestedActions: string[];
}

export interface CapacityThresholds {
  warningPercent: number; // e.g., 75%
  criticalPercent: number; // e.g., 90%
  maxSizeBytes: number; // maximum allowed storage
  dailyGrowthLimitBytes: number; // maximum daily growth
}

export interface CleanupSuggestion {
  type: 'delete_old' | 'compress' | 'archive' | 'remove_duplicates';
  description: string;
  estimatedSpaceSaved: number;
  riskLevel: 'low' | 'medium' | 'high';
  files: string[];
  autoExecutable: boolean;
}

export class StorageMonitoringService {
  private static readonly DEFAULT_THRESHOLDS: CapacityThresholds = {
    warningPercent: 75,
    criticalPercent: 90,
    maxSizeBytes: 50 * 1024 * 1024 * 1024, // 50GB default
    dailyGrowthLimitBytes: 1 * 1024 * 1024 * 1024 // 1GB per day
  };

  private static readonly OLD_FILE_THRESHOLD_DAYS = 365; // 1 year
  private static readonly LARGE_FILE_THRESHOLD_MB = 50; // 50MB

  /**
   * Get comprehensive storage statistics
   */
  static async getStorageStats(): Promise<StorageStats> {
    try {
      console.log('Calculating storage statistics...');

      // Get all recordings from database with metadata
      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('file_path, submitted_at, metadata');

      if (error) {
        throw error;
      }

      if (!recordings || recordings.length === 0) {
        return {
          totalFiles: 0,
          totalSize: 0,
          averageFileSize: 0,
          largestFile: { path: '', size: 0 },
          oldestFile: { path: '', date: '' },
          newestFile: { path: '', date: '' },
          lastUpdated: new Date().toISOString()
        };
      }

      // Calculate statistics
      let totalSize = 0;
      let largestFile = { path: '', size: 0 };
      let oldestFile = { path: '', date: new Date().toISOString() };
      let newestFile = { path: '', date: '1970-01-01T00:00:00.000Z' };

      for (const recording of recordings) {
        const fileSize = recording.metadata?.fileSize || 0;
        totalSize += fileSize;

        // Track largest file
        if (fileSize > largestFile.size) {
          largestFile = {
            path: recording.file_path,
            size: fileSize
          };
        }

        // Track oldest and newest files
        const submittedDate = recording.submitted_at;
        if (submittedDate < oldestFile.date) {
          oldestFile = {
            path: recording.file_path,
            date: submittedDate
          };
        }
        if (submittedDate > newestFile.date) {
          newestFile = {
            path: recording.file_path,
            date: submittedDate
          };
        }
      }

      const averageFileSize = recordings.length > 0 ? totalSize / recordings.length : 0;

      return {
        totalFiles: recordings.length,
        totalSize,
        averageFileSize,
        largestFile,
        oldestFile,
        newestFile,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error calculating storage stats:', error);
      throw error;
    }
  }

  /**
   * Get detailed usage analytics broken down by various categories
   */
  static async getUsageAnalytics(): Promise<UsageAnalytics> {
    try {
      console.log('Calculating usage analytics...');

      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select(`
          file_path,
          submitted_at,
          metadata,
          class:classes!recording_submissions_class_id_fkey(name, grade_level)
        `);

      if (error) {
        throw error;
      }

      const overallStats = await this.getStorageStats();
      const categoryData: { [key: string]: { fileCount: number; totalSize: number } } = {};

      // Initialize categories
      const bySchoolYear: { [key: string]: { fileCount: number; totalSize: number } } = {};
      const byGrade: { [key: string]: { fileCount: number; totalSize: number } } = {};
      const byClass: { [key: string]: { fileCount: number; totalSize: number } } = {};
      const byMonth: { [key: string]: { fileCount: number; totalSize: number } } = {};
      const byFileType: { [key: string]: { fileCount: number; totalSize: number } } = {};

      // Process each recording
      for (const recording of recordings || []) {
        const fileSize = recording.metadata?.fileSize || 0;
        const submittedDate = new Date(recording.submitted_at);

        // Parse file path for organization info
        const { isOrganized, components } = FileOrganizationService.parseExistingPath(recording.file_path);

        // By school year
        const schoolYear = isOrganized && components ? components.schoolYear : submittedDate.getFullYear().toString();
        if (!bySchoolYear[schoolYear]) bySchoolYear[schoolYear] = { fileCount: 0, totalSize: 0 };
        bySchoolYear[schoolYear].fileCount++;
        bySchoolYear[schoolYear].totalSize += fileSize;

        // By grade
        const gradeLevel = recording.class?.grade_level?.toString() || 'Unknown';
        if (!byGrade[gradeLevel]) byGrade[gradeLevel] = { fileCount: 0, totalSize: 0 };
        byGrade[gradeLevel].fileCount++;
        byGrade[gradeLevel].totalSize += fileSize;

        // By class
        const className = recording.class?.name || 'Unknown';
        if (!byClass[className]) byClass[className] = { fileCount: 0, totalSize: 0 };
        byClass[className].fileCount++;
        byClass[className].totalSize += fileSize;

        // By month
        const monthKey = `${submittedDate.getFullYear()}-${String(submittedDate.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonth[monthKey]) byMonth[monthKey] = { fileCount: 0, totalSize: 0 };
        byMonth[monthKey].fileCount++;
        byMonth[monthKey].totalSize += fileSize;

        // By file type
        const fileExtension = recording.file_path.split('.').pop()?.toLowerCase() || 'unknown';
        if (!byFileType[fileExtension]) byFileType[fileExtension] = { fileCount: 0, totalSize: 0 };
        byFileType[fileExtension].fileCount++;
        byFileType[fileExtension].totalSize += fileSize;
      }

      // Convert to UsageByCategory format
      const convertToUsageCategories = (data: { [key: string]: { fileCount: number; totalSize: number } }): UsageByCategory[] => {
        const totalSize = Object.values(data).reduce((sum, item) => sum + item.totalSize, 0);
        
        return Object.entries(data).map(([category, stats]) => ({
          category,
          fileCount: stats.fileCount,
          totalSize: stats.totalSize,
          averageSize: stats.fileCount > 0 ? stats.totalSize / stats.fileCount : 0,
          percentage: totalSize > 0 ? (stats.totalSize / totalSize) * 100 : 0
        })).sort((a, b) => b.totalSize - a.totalSize);
      };

      // Calculate growth trends
      const trends = await this.calculateGrowthTrends(recordings || []);

      return {
        bySchoolYear: convertToUsageCategories(bySchoolYear),
        byGrade: convertToUsageCategories(byGrade),
        byClass: convertToUsageCategories(byClass),
        byMonth: convertToUsageCategories(byMonth),
        byFileType: convertToUsageCategories(byFileType),
        overallStats,
        trends
      };
    } catch (error) {
      console.error('Error calculating usage analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate growth trends from historical data
   */
  private static async calculateGrowthTrends(recordings: any[]): Promise<UsageAnalytics['trends']> {
    if (recordings.length === 0) {
      return {
        dailyGrowth: 0,
        weeklyGrowth: 0,
        monthlyGrowth: 0,
        projectedMonthlyGrowth: 0
      };
    }

    // Group recordings by date
    const dailyData: { [date: string]: number } = {};
    
    for (const recording of recordings) {
      const date = recording.submitted_at.split('T')[0]; // Get YYYY-MM-DD
      const fileSize = recording.metadata?.fileSize || 0;
      
      if (!dailyData[date]) dailyData[date] = 0;
      dailyData[date] += fileSize;
    }

    const dates = Object.keys(dailyData).sort();
    const now = new Date();
    
    // Calculate daily growth (last 7 days average)
    const last7Days = dates.slice(-7);
    const dailyGrowth = last7Days.length > 1 ? 
      last7Days.reduce((sum, date) => sum + dailyData[date], 0) / last7Days.length : 0;

    // Calculate weekly growth (last 4 weeks average)
    const last28Days = dates.slice(-28);
    const weeklyGrowth = last28Days.length > 0 ? 
      (last28Days.reduce((sum, date) => sum + dailyData[date], 0) / last28Days.length) * 7 : 0;

    // Calculate monthly growth (last 3 months average)
    const last90Days = dates.slice(-90);
    const monthlyGrowth = last90Days.length > 0 ? 
      (last90Days.reduce((sum, date) => sum + dailyData[date], 0) / last90Days.length) * 30 : 0;

    // Project next month's growth based on recent trends
    const projectedMonthlyGrowth = dailyGrowth * 30;

    return {
      dailyGrowth,
      weeklyGrowth,
      monthlyGrowth,
      projectedMonthlyGrowth
    };
  }

  /**
   * Check storage against capacity thresholds and generate alerts
   */
  static async checkCapacityAlerts(thresholds: CapacityThresholds = this.DEFAULT_THRESHOLDS): Promise<StorageAlert[]> {
    const alerts: StorageAlert[] = [];

    try {
      const stats = await this.getStorageStats();
      const analytics = await this.getUsageAnalytics();

      // Check overall capacity
      const usagePercent = (stats.totalSize / thresholds.maxSizeBytes) * 100;
      
      if (usagePercent >= thresholds.criticalPercent) {
        alerts.push({
          id: `capacity-critical-${Date.now()}`,
          type: 'capacity',
          severity: 'critical',
          message: `Storage usage at ${usagePercent.toFixed(1)}% (critical threshold: ${thresholds.criticalPercent}%)`,
          details: { usagePercent, totalSize: stats.totalSize, maxSize: thresholds.maxSizeBytes },
          createdAt: new Date().toISOString(),
          acknowledged: false,
          actionRequired: true,
          suggestedActions: [
            'Immediately archive old recordings',
            'Compress large files',
            'Delete unnecessary duplicates',
            'Increase storage capacity'
          ]
        });
      } else if (usagePercent >= thresholds.warningPercent) {
        alerts.push({
          id: `capacity-warning-${Date.now()}`,
          type: 'capacity',
          severity: 'high',
          message: `Storage usage at ${usagePercent.toFixed(1)}% (warning threshold: ${thresholds.warningPercent}%)`,
          details: { usagePercent, totalSize: stats.totalSize, maxSize: thresholds.maxSizeBytes },
          createdAt: new Date().toISOString(),
          acknowledged: false,
          actionRequired: false,
          suggestedActions: [
            'Review and archive old recordings',
            'Plan for storage capacity increase',
            'Implement cleanup procedures'
          ]
        });
      }

      // Check growth rate
      if (analytics.trends.dailyGrowth > thresholds.dailyGrowthLimitBytes) {
        alerts.push({
          id: `growth-rate-${Date.now()}`,
          type: 'growth_rate',
          severity: 'medium',
          message: `Daily growth rate (${(analytics.trends.dailyGrowth / 1024 / 1024).toFixed(1)}MB) exceeds limit (${(thresholds.dailyGrowthLimitBytes / 1024 / 1024).toFixed(1)}MB)`,
          details: { dailyGrowth: analytics.trends.dailyGrowth, limit: thresholds.dailyGrowthLimitBytes },
          createdAt: new Date().toISOString(),
          acknowledged: false,
          actionRequired: false,
          suggestedActions: [
            'Monitor upload patterns',
            'Check for unusual activity',
            'Consider rate limiting'
          ]
        });
      }

      // Check for old files
      const oldFileThreshold = new Date();
      oldFileThreshold.setDate(oldFileThreshold.getDate() - this.OLD_FILE_THRESHOLD_DAYS);
      
      if (new Date(stats.oldestFile.date) < oldFileThreshold) {
        alerts.push({
          id: `old-files-${Date.now()}`,
          type: 'old_files',
          severity: 'low',
          message: `Files older than ${this.OLD_FILE_THRESHOLD_DAYS} days detected`,
          details: { oldestFileDate: stats.oldestFile.date, threshold: oldFileThreshold.toISOString() },
          createdAt: new Date().toISOString(),
          acknowledged: false,
          actionRequired: false,
          suggestedActions: [
            'Review archival policies',
            'Archive old recordings',
            'Delete obsolete files'
          ]
        });
      }

      // Check for large files
      const largeSizeThreshold = this.LARGE_FILE_THRESHOLD_MB * 1024 * 1024;
      if (stats.largestFile.size > largeSizeThreshold) {
        alerts.push({
          id: `large-files-${Date.now()}`,
          type: 'large_files',
          severity: 'low',
          message: `Large files detected (largest: ${(stats.largestFile.size / 1024 / 1024).toFixed(1)}MB)`,
          details: { largestFile: stats.largestFile, threshold: this.LARGE_FILE_THRESHOLD_MB },
          createdAt: new Date().toISOString(),
          acknowledged: false,
          actionRequired: false,
          suggestedActions: [
            'Compress large audio files',
            'Review recording quality settings',
            'Implement file size limits'
          ]
        });
      }

    } catch (error) {
      console.error('Error checking capacity alerts:', error);
      alerts.push({
        id: `monitoring-error-${Date.now()}`,
        type: 'capacity',
        severity: 'medium',
        message: 'Storage monitoring system encountered an error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        createdAt: new Date().toISOString(),
        acknowledged: false,
        actionRequired: true,
        suggestedActions: ['Check monitoring service logs', 'Verify database connectivity']
      });
    }

    return alerts;
  }

  /**
   * Generate cleanup suggestions based on current storage state
   */
  static async generateCleanupSuggestions(): Promise<CleanupSuggestion[]> {
    const suggestions: CleanupSuggestion[] = [];

    try {
      const analytics = await this.getUsageAnalytics();
      
      // Get all recordings for analysis
      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('id, file_path, submitted_at, metadata, archived');

      if (error) {
        throw error;
      }

      // Suggest archiving old files
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const oldFiles = recordings?.filter(r => 
        new Date(r.submitted_at) < oneYearAgo && !r.archived
      ) || [];
      
      if (oldFiles.length > 0) {
        const spaceSaved = oldFiles.reduce((sum, file) => sum + (file.metadata?.fileSize || 0), 0);
        
        suggestions.push({
          type: 'archive',
          description: `Archive ${oldFiles.length} recordings older than 1 year`,
          estimatedSpaceSaved: spaceSaved,
          riskLevel: 'low',
          files: oldFiles.map(f => f.file_path),
          autoExecutable: true
        });
      }

      // Suggest compressing large files
      const largeSizeThreshold = this.LARGE_FILE_THRESHOLD_MB * 1024 * 1024;
      const largeFiles = recordings?.filter(r => 
        (r.metadata?.fileSize || 0) > largeSizeThreshold
      ) || [];
      
      if (largeFiles.length > 0) {
        const spaceSaved = largeFiles.reduce((sum, file) => 
          sum + (file.metadata?.fileSize || 0) * 0.3, 0 // Assume 30% compression
        );
        
        suggestions.push({
          type: 'compress',
          description: `Compress ${largeFiles.length} large audio files`,
          estimatedSpaceSaved: spaceSaved,
          riskLevel: 'low',
          files: largeFiles.map(f => f.file_path),
          autoExecutable: false // Requires quality verification
        });
      }

      // Suggest deleting very old files (over 2 years)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      const veryOldFiles = recordings?.filter(r => 
        new Date(r.submitted_at) < twoYearsAgo && r.archived
      ) || [];
      
      if (veryOldFiles.length > 10) { // Only suggest if significant number
        const spaceSaved = veryOldFiles.reduce((sum, file) => sum + (file.metadata?.fileSize || 0), 0);
        
        suggestions.push({
          type: 'delete_old',
          description: `Delete ${veryOldFiles.length} archived recordings older than 2 years`,
          estimatedSpaceSaved: spaceSaved,
          riskLevel: 'medium',
          files: veryOldFiles.map(f => f.file_path),
          autoExecutable: false // Requires manual approval
        });
      }

    } catch (error) {
      console.error('Error generating cleanup suggestions:', error);
    }

    return suggestions;
  }

  /**
   * Get storage usage by time period for trend analysis
   */
  static async getUsageTrends(periodDays: number = 30): Promise<{
    daily: { date: string; size: number; count: number }[];
    summary: {
      totalGrowth: number;
      averageDailyGrowth: number;
      peakDay: string;
      peakDayGrowth: number;
    };
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const { data: recordings, error } = await supabase
        .from('recording_submissions')
        .select('submitted_at, metadata')
        .gte('submitted_at', startDate.toISOString())
        .order('submitted_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Group by day
      const dailyData: { [date: string]: { size: number; count: number } } = {};
      
      for (const recording of recordings || []) {
        const date = recording.submitted_at.split('T')[0];
        const fileSize = recording.metadata?.fileSize || 0;
        
        if (!dailyData[date]) {
          dailyData[date] = { size: 0, count: 0 };
        }
        
        dailyData[date].size += fileSize;
        dailyData[date].count++;
      }

      // Convert to array format
      const daily = Object.entries(dailyData).map(([date, data]) => ({
        date,
        size: data.size,
        count: data.count
      }));

      // Calculate summary statistics
      const totalGrowth = daily.reduce((sum, day) => sum + day.size, 0);
      const averageDailyGrowth = daily.length > 0 ? totalGrowth / daily.length : 0;
      
      const peakDay = daily.reduce((peak, day) => 
        day.size > peak.size ? day : peak, 
        { date: '', size: 0, count: 0 }
      );

      return {
        daily,
        summary: {
          totalGrowth,
          averageDailyGrowth,
          peakDay: peakDay.date,
          peakDayGrowth: peakDay.size
        }
      };
    } catch (error) {
      console.error('Error getting usage trends:', error);
      return {
        daily: [],
        summary: {
          totalGrowth: 0,
          averageDailyGrowth: 0,
          peakDay: '',
          peakDayGrowth: 0
        }
      };
    }
  }

  /**
   * Format file size for human-readable display
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  /**
   * Get comprehensive storage dashboard data
   */
  static async getDashboardData(): Promise<{
    stats: StorageStats;
    analytics: UsageAnalytics;
    alerts: StorageAlert[];
    suggestions: CleanupSuggestion[];
    trends: Awaited<ReturnType<typeof this.getUsageTrends>>;
  }> {
    try {
      const [stats, analytics, alerts, suggestions, trends] = await Promise.all([
        this.getStorageStats(),
        this.getUsageAnalytics(),
        this.checkCapacityAlerts(),
        this.generateCleanupSuggestions(),
        this.getUsageTrends()
      ]);

      return {
        stats,
        analytics,
        alerts,
        suggestions,
        trends
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }
}