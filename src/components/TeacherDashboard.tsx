import React, { useState, useEffect } from 'react';
import { BookOpen, Users, FileText, Play, Pause, Download, Filter, Search, RefreshCw, Calendar, Copy, ExternalLink, Check, Archive, Trash2, RotateCcw, Eye, BarChart3, Clock, Star } from 'lucide-react';
import { useAuth } from '../contexts/UnifiedAuthContext';
import { apiClient, type ClassInfo, type Recording } from '../services/apiClient';
import { AssignmentManager } from './AssignmentManager';
import { FeedbackData } from '../types';

// Use ClassInfo from API client instead of custom interface

export const TeacherDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recordings' | 'assignments'>('recordings');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [assignmentRefreshTrigger, setAssignmentRefreshTrigger] = useState(0);
  const [selectedAnalysis, setSelectedAnalysis] = useState<FeedbackData | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // Fetch teacher's classes
  useEffect(() => {
    fetchTeacherClasses();
  }, []);

  // Fetch recordings when class is selected
  useEffect(() => {
    if (selectedClassId) {
      fetchClassRecordings(selectedClassId);
    }
  }, [selectedClassId]);

  // Auto-refresh recordings every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh || !selectedClassId || activeTab !== 'recordings') {
      return;
    }

    const interval = setInterval(() => {
      fetchClassRecordings(selectedClassId);
      setLastRefreshTime(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, selectedClassId, activeTab]);

  const fetchTeacherClasses = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const result = await apiClient.getClasses(user.id);
      if (result.error) {
        console.error('Error fetching classes:', result.error);
        // Fall back to empty array but don't show error to user yet
        setClasses([]);
      } else {
        setClasses(result.classes || []);
        if (result.classes && result.classes.length > 0) {
          setSelectedClassId(result.classes[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassRecordings = async (classId: string) => {
    setRefreshing(true);
    try {
      const result = await apiClient.getRecordings(classId);
      if (result.error) {
        console.error('Error fetching recordings:', result.error);
      } else {
        const previousCount = recordings.length;
        const newCount = result.recordings?.length || 0;
        
        setRecordings(result.recordings || []);
        setLastRefreshTime(new Date());
        
        // If new recordings were added, trigger assignment refresh
        if (newCount > previousCount) {
          console.log('New recordings detected, triggering assignment refresh...');
          setAssignmentRefreshTrigger(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePlayRecording = async (recording: Recording) => {
    if (playingRecording === recording.id) {
      setPlayingRecording(null);
      return;
    }

    try {
      const { url, error } = await apiClient.getRecordingUrl(recording.id);
      if (error || !url) {
        console.error('Error getting recording URL:', error);
        return;
      }

      setPlayingRecording(recording.id);
      const audio = new Audio(url);
      audio.play();
      
      audio.onended = () => setPlayingRecording(null);
      audio.onerror = () => setPlayingRecording(null);
    } catch (error) {
      console.error('Error playing recording:', error);
      setPlayingRecording(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const copyClassLink = async (classInfo: TeacherClass) => {
    if (!classInfo.access_token) return;
    
    const classLink = `${window.location.origin}/class/${classInfo.access_token}`;
    
    try {
      await navigator.clipboard.writeText(classLink);
      setCopiedLink(classInfo.id);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = classLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLink(classInfo.id);
      setTimeout(() => setCopiedLink(null), 2000);
    }
  };

  const handleArchiveRecording = async (recording: Recording) => {
    if (actionLoading) return;
    
    setActionLoading(recording.id);
    try {
      const result = await apiClient.archiveRecording(recording.id);
      if (!result.error) {
        // Refresh recordings
        if (selectedClassId) {
          await fetchClassRecordings(selectedClassId);
        }
      } else {
        console.error('Failed to archive recording:', result.error);
        alert('Failed to archive recording. Please try again.');
      }
    } catch (error) {
      console.error('Error archiving recording:', error);
      alert('Failed to archive recording. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnarchiveRecording = async (recording: Recording) => {
    if (actionLoading) return;
    
    setActionLoading(recording.id);
    try {
      const result = await apiClient.unarchiveRecording(recording.id);
      if (!result.error) {
        // Refresh recordings
        if (selectedClassId) {
          await fetchClassRecordings(selectedClassId);
        }
      } else {
        console.error('Failed to unarchive recording:', result.error);
        alert('Failed to unarchive recording. Please try again.');
      }
    } catch (error) {
      console.error('Error unarchiving recording:', error);
      alert('Failed to unarchive recording. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRecording = async (recording: Recording) => {
    if (actionLoading) return;
    
    const studentName = recording.student_name || 'Unknown Student';
    const confirmMessage = `Are you sure you want to permanently delete this recording by ${studentName}?\n\nThis action cannot be undone and will remove both the audio file and all associated data.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    setActionLoading(recording.id);
    try {
      const result = await apiClient.deleteRecording(recording.id);
      if (!result.error) {
        // Refresh recordings
        if (selectedClassId) {
          await fetchClassRecordings(selectedClassId);
        }
      } else {
        console.error('Failed to delete recording:', result.error);
        alert('Failed to delete recording. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
      alert('Failed to delete recording. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // Extract speech analysis from recording metadata
  const getRecordingAnalysis = (recording: Recording): FeedbackData | null => {
    if (!recording.feedback_data || typeof recording.feedback_data !== 'object') {
      return null;
    }
    return recording.feedback_data || null;
  };

  // Handle viewing detailed analysis
  const handleViewAnalysis = (recording: Recording) => {
    const analysis = getRecordingAnalysis(recording);
    if (analysis) {
      setSelectedAnalysis(analysis);
      setShowAnalysisModal(true);
    }
  };

  // Get analysis status badge
  const getAnalysisStatusBadge = (recording: Recording) => {
    const analysis = getRecordingAnalysis(recording);
    
    if (recording.status === 'processing') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <Clock className="h-3 w-3 animate-spin" />
          Processing
        </span>
      );
    }
    
    if (recording.status === 'failed') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Analysis Failed
        </span>
      );
    }
    
    if (!analysis) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          No Analysis
        </span>
      );
    }

    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
        <BarChart3 className="h-3 w-3" />
        {analysis.accuracy}% Accuracy
      </span>
    );
  };

  // Filter recordings based on status, archive status, and search term
  const filteredRecordings = recordings.filter(recording => {
    const matchesStatus = filterStatus === 'all' || recording.status === filterStatus;
    const matchesArchived = showArchived ? recording.archived === true : recording.archived !== true;
    const matchesSearch = searchTerm === '' || 
      recording.story_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (recording.student as any)?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesArchived && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
                <p className="text-gray-600">Welcome back, {user?.full_name}</p>
              </div>
            </div>
            
            <button
              onClick={signOut}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Class Selection */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Classes
            </h2>
          </div>
          
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="p-1 bg-blue-100 rounded">
                <ExternalLink className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-blue-800 mb-1">Share Class Links with Students</h3>
                <p className="text-sm text-blue-700">
                  Each class has a unique access link below. Students can use this link to join your class and access assignments. 
                  Share the link via email, Google Classroom, or write it on the board.
                </p>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((classInfo) => (
              <div
                key={classInfo.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedClassId === classInfo.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <button
                  onClick={() => setSelectedClassId(classInfo.id)}
                  className="w-full text-left mb-3 hover:bg-white hover:bg-opacity-50 rounded p-2 -m-2 transition-colors"
                >
                  <h3 className="font-semibold text-gray-800">{classInfo.name}</h3>
                  <p className="text-sm text-gray-600">Grade {classInfo.grade_level}</p>
                  <p className="text-sm text-gray-500">{classInfo.student_count} students</p>
                </button>
                
                {/* Class Access Link */}
                {classInfo.access_token && (
                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">Student Access Link</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded px-2 py-1 text-xs font-mono text-gray-700 truncate">
                        {window.location.origin}/class/{classInfo.access_token}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyClassLink(classInfo);
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Copy class link"
                      >
                        {copiedLink === classInfo.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      <a
                        href={`${window.location.origin}/class/${classInfo.access_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Open class link"
                      >
                        <ExternalLink className="h-4 w-4 text-gray-500" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        {selectedClassId && (
          <div className="bg-white rounded-lg shadow-sm mb-8">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('recordings')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'recordings'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Student Recordings
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('assignments');
                    // Trigger assignment refresh when switching to assignments tab
                    if (activeTab !== 'assignments') {
                      setTimeout(() => setAssignmentRefreshTrigger(prev => prev + 1), 100);
                    }
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'assignments'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Assignments
                  </div>
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {selectedClassId && activeTab === 'recordings' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Student Recordings
                </h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Auto-refresh (30s)
                    </label>
                  </div>
                  <div className="text-xs text-gray-500">
                    Last updated: {lastRefreshTime.toLocaleTimeString()}
                  </div>
                  <button
                    onClick={() => selectedClassId && fetchClassRecordings(selectedClassId)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Filters and Search */}
              <div className="flex gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-gray-500" />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showArchived}
                      onChange={(e) => setShowArchived(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Show Archived
                  </label>
                </div>
                
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <Search className="h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search by student name or story..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Recordings List */}
            <div className="p-6">
              {filteredRecordings.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No recordings found</h3>
                  <p className="text-gray-500">
                    {recordings.length === 0 
                      ? "Students haven't submitted any recordings yet." 
                      : "No recordings match your current filters."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecordings.map((recording) => (
                    <div key={recording.id} className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${recording.archived ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-800">
                              {(recording.student as any)?.full_name || 'Unknown Student'}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(recording.status)}`}>
                              {recording.status}
                            </span>
                            {getAnalysisStatusBadge(recording)}
                            {recording.archived && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 flex items-center gap-1">
                                <Archive className="h-3 w-3" />
                                Archived
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><span className="font-medium">Story:</span> {recording.story_id}</p>
                            {recording.assignment_id && (
                              <p><span className="font-medium">Assignment:</span> 
                                <span className="ml-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  Assignment Submission
                                </span>
                              </p>
                            )}
                            <p><span className="font-medium">Duration:</span> {formatDuration(recording.duration)}</p>
                            <p><span className="font-medium">Submitted:</span> {formatDate(recording.submitted_at)}</p>
                            <p><span className="font-medium">Type:</span> 
                              <span className={`ml-1 px-2 py-1 text-xs rounded-full ${
                                recording.assignment_id 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {recording.assignment_id ? 'Assignment' : 'Free Practice'}
                              </span>
                            </p>
                            {(() => {
                              const analysis = getRecordingAnalysis(recording);
                              if (analysis) {
                                return (
                                  <div className="mt-2 p-2 bg-green-50 rounded-md border border-green-200">
                                    <p className="text-sm font-medium text-green-800 mb-1">Speech Analysis Results:</p>
                                    <div className="flex flex-wrap gap-3 text-xs text-green-700">
                                      <span>Accuracy: {analysis.accuracy}%</span>
                                      <span>Pace: {analysis.readingPace}</span>
                                      <span>Pauses: {analysis.pauseCount}</span>
                                      {analysis.wordsPerMinute && <span>WPM: {Math.round(analysis.wordsPerMinute)}</span>}
                                      {analysis.fluencyScore && <span>Fluency: {Math.round(analysis.fluencyScore)}%</span>}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePlayRecording(recording)}
                            disabled={actionLoading === recording.id}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {playingRecording === recording.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            {playingRecording === recording.id ? 'Playing...' : 'Play'}
                          </button>
                          
                          {getRecordingAnalysis(recording) && (
                            <button
                              onClick={() => handleViewAnalysis(recording)}
                              className="flex items-center gap-2 px-3 py-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors"
                              title="View detailed analysis"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}

                          <button
                            onClick={() => apiClient.getRecordingUrl(recording.id).then(({url}) => {
                              if (url) window.open(url, '_blank');
                            })}
                            disabled={actionLoading === recording.id}
                            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Download recording"
                          >
                            <Download className="h-4 w-4" />
                          </button>

                          {recording.archived ? (
                            <button
                              onClick={() => handleUnarchiveRecording(recording)}
                              disabled={actionLoading === recording.id}
                              className="flex items-center gap-2 px-3 py-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                              title="Unarchive recording"
                            >
                              {actionLoading === recording.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchiveRecording(recording)}
                              disabled={actionLoading === recording.id}
                              className="flex items-center gap-2 px-3 py-2 text-orange-600 hover:text-orange-800 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-50"
                              title="Archive recording"
                            >
                              {actionLoading === recording.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Archive className="h-4 w-4" />
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteRecording(recording)}
                            disabled={actionLoading === recording.id}
                            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete recording permanently"
                          >
                            {actionLoading === recording.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assignments Tab */}
        {selectedClassId && activeTab === 'assignments' && (
          <AssignmentManager 
            classes={classes}
            refreshTrigger={assignmentRefreshTrigger}
            onAssignmentCreated={() => {
              // Refresh recordings when assignment is created
              console.log('Assignment created, refreshing data...');
              if (selectedClassId) {
                fetchClassRecordings(selectedClassId);
              }
            }}
          />
        )}

        {/* Analysis Modal */}
        {showAnalysisModal && selectedAnalysis && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <BarChart3 className="h-6 w-6 text-blue-600" />
                    Speech Analysis Results
                  </h2>
                  <button
                    onClick={() => setShowAnalysisModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Summary Metrics */}
                <div className="grid md:grid-cols-4 gap-4 mb-8">
                  <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="text-3xl font-bold text-blue-600 mb-1">{selectedAnalysis.accuracy}%</div>
                    <div className="text-sm font-medium text-gray-700">Accuracy</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="text-lg font-bold text-purple-600 mb-1">
                      {selectedAnalysis.readingPace === 'just-right' ? 'Perfect' : 
                       selectedAnalysis.readingPace === 'too-fast' ? 'Too Fast' : 'Too Slow'}
                    </div>
                    <div className="text-sm font-medium text-gray-700">Reading Pace</div>
                    {selectedAnalysis.wordsPerMinute && (
                      <div className="text-xs text-gray-500 mt-1">{Math.round(selectedAnalysis.wordsPerMinute)} WPM</div>
                    )}
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-200">
                    <div className="text-2xl font-bold text-orange-600 mb-1">{selectedAnalysis.pauseCount}</div>
                    <div className="text-sm font-medium text-gray-700">Pauses</div>
                  </div>
                  {selectedAnalysis.fluencyScore !== undefined && (
                    <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="text-2xl font-bold text-green-600 mb-1">{Math.round(selectedAnalysis.fluencyScore)}%</div>
                      <div className="text-sm font-medium text-gray-700">Fluency</div>
                    </div>
                  )}
                </div>

                {/* Transcript */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span>🎤</span> Student Transcript
                  </h3>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-gray-700 italic">"{selectedAnalysis.transcript}"</p>
                  </div>
                </div>

                {/* Word Analysis */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span>🔍</span> Word-by-Word Analysis
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-4 border max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {selectedAnalysis.wordAnalysis.map((word, index) => (
                        <div
                          key={index}
                          className={`p-2 rounded-lg border-l-4 ${
                            word.status === 'correct' ? 'border-green-500 bg-green-50' :
                            word.status === 'incorrect' ? 'border-orange-500 bg-orange-50' :
                            word.status === 'missed' ? 'border-red-500 bg-red-50' :
                            'border-purple-500 bg-purple-50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium">
                                {word.status === 'extra' ? '(extra)' : word.originalWord}
                              </span>
                              {word.spokenWord && word.spokenWord !== word.originalWord && (
                                <span className="ml-2 text-gray-600">→ "{word.spokenWord}"</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                word.status === 'correct' ? 'bg-green-200 text-green-800' :
                                word.status === 'incorrect' ? 'bg-orange-200 text-orange-800' :
                                word.status === 'missed' ? 'bg-red-200 text-red-800' :
                                'bg-purple-200 text-purple-800'
                              }`}>
                                {word.status}
                              </span>
                              {word.confidence && (
                                <span className="text-xs text-gray-500">
                                  {Math.round(word.confidence * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{selectedAnalysis.correctWords.length}</div>
                      <div className="text-sm font-medium text-gray-700">Correct Words</div>
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{selectedAnalysis.incorrectWords.length}</div>
                      <div className="text-sm font-medium text-gray-700">Incorrect Words</div>
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{selectedAnalysis.missedWords.length}</div>
                      <div className="text-sm font-medium text-gray-700">Missed Words</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};