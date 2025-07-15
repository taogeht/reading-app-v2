import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, AlertCircle, User, LogOut, ArrowLeft, Calendar } from 'lucide-react';
import { useStudentAuth } from '../contexts/StudentAuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { VoiceSettings } from './VoiceSettings';
import { TTSPlayer } from './TTSPlayer';
import { VoiceRecorder } from './VoiceRecorder';
import { RecordingUploadService, RecordingMetadata } from '../services/RecordingUploadService';
import { Story, VoiceSettings as VoiceSettingsType } from '../types';

interface Assignment {
  id: string;
  title: string;
  story_title: string;
  story_id: string;
  due_date?: string;
  instructions?: string;
}

export const AssignmentPractice: React.FC = () => {
  const { session, signOut, getAssignmentsForClass } = useStudentAuth();
  const navigate = useNavigate();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsType>({
    accent: 'USA',
    gender: 'Female',
  });
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Handle authentication and redirect
  useEffect(() => {
    // Redirect if not logged in as student
    if (!session) {
      navigate('/');
      return;
    }
  }, [session, navigate]);

  // Load assignment and story data
  useEffect(() => {
    const loadAssignmentData = async () => {
      if (!session?.class_id || !assignmentId) {
        setError('Invalid assignment or session');
        setLoading(false);
        return;
      }

      try {
        console.log('Loading assignment:', assignmentId);

        // Get assignments for the class
        const { assignments, error: assignmentError } = await getAssignmentsForClass(session.class_id);
        
        if (assignmentError) {
          setError('Failed to load assignment');
          setLoading(false);
          return;
        }

        // Find the specific assignment
        const foundAssignment = assignments.find((a: any) => a.id === assignmentId);
        if (!foundAssignment) {
          setError('Assignment not found');
          setLoading(false);
          return;
        }

        setAssignment(foundAssignment);
        console.log('Found assignment:', foundAssignment);

        // Load the story data
        const response = await fetch('/stories.json');
        if (response.ok) {
          const storiesData = await response.json();
          const foundStory = storiesData.find((story: Story) => story.id === foundAssignment.story_id);
          
          if (foundStory) {
            setStory(foundStory);
            console.log('Found story:', foundStory.title);
          } else {
            setError('Story not found for this assignment');
          }
        } else {
          setError('Failed to load story data');
        }
      } catch (error) {
        console.error('Error loading assignment:', error);
        setError('Failed to load assignment');
      } finally {
        setLoading(false);
      }
    };

    // Only load assignment data if we have a session
    if (session?.class_id && assignmentId) {
      loadAssignmentData();
    }
  }, [session, assignmentId, getAssignmentsForClass]);

  // Early return if no session (component will redirect via useEffect)
  if (!session) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleRecordingSubmit = async (audioBlob: Blob, metadata: RecordingMetadata) => {
    if (!session?.student_id || !session?.class_id || !assignment) {
      setSubmissionError('Session information missing. Please log in again.');
      return;
    }

    setSubmissionError(null);
    setSubmissionSuccess(null);

    try {
      // Include assignment ID and story text for analysis
      const assignmentMetadata: RecordingMetadata = {
        ...metadata,
        storyText: story?.text, // Include story text for analysis
        assignmentId: assignment.id
      };

      const result = await RecordingUploadService.uploadRecording(
        audioBlob,
        assignmentMetadata,
        session.student_id,
        session.class_id
      );

      if (result.success) {
        setSubmissionSuccess(`Assignment recording submitted successfully! Your teacher will review it soon.`);
        // Clear the success message after 5 seconds
        setTimeout(() => setSubmissionSuccess(null), 5000);
      } else {
        setSubmissionError(result.error || 'Failed to submit recording');
      }
    } catch (error) {
      console.error('Error submitting recording:', error);
      setSubmissionError('An unexpected error occurred while submitting your recording.');
    }
  };

  const handleClearMessages = () => {
    setSubmissionSuccess(null);
    setSubmissionError(null);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assignment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Assignment Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/assignments')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Assignments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Assignment Practice</h1>
                <p className="text-gray-600">
                  Reading assignment for {session.student?.full_name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                <User className="h-5 w-5 text-gray-500" />
                <span className="text-gray-700 font-medium">{session.student?.full_name}</span>
              </div>
              <button
                onClick={() => navigate('/assignments')}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Assignments
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Assignment Details */}
        {assignment && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{assignment.title}</h2>
                <p className="text-lg text-gray-700 mb-3">
                  <span className="font-medium">Story:</span> {assignment.story_title}
                </p>
                {assignment.due_date && (
                  <p className="text-sm text-blue-600 mb-3">
                    <span className="font-medium">Due:</span> {formatDate(assignment.due_date)}
                  </p>
                )}
                {assignment.instructions && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-800 mb-2">Instructions:</h3>
                    <p className="text-blue-700">{assignment.instructions}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {story && (
          <>
            {/* Voice Settings */}
            <VoiceSettings
              settings={voiceSettings}
              onSettingsChange={setVoiceSettings}
            />

            {/* TTS Player */}
            <TTSPlayer
              story={story}
              voiceSettings={voiceSettings}
              onWordHighlight={setHighlightedWordIndex}
            />

            {/* Voice Recorder */}
            <VoiceRecorder
              story={story}
              onRecordingSubmit={handleRecordingSubmit}
              highlightedWordIndex={highlightedWordIndex}
            />

            {/* Submission Success Message */}
            {submissionSuccess && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <h3 className="text-xl font-semibold text-green-800">Assignment Submitted!</h3>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-green-700">{submissionSuccess}</p>
                </div>
                <div className="flex justify-center gap-3 mt-4">
                  <button
                    onClick={handleClearMessages}
                    className="px-4 py-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => navigate('/assignments')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Back to Assignments
                  </button>
                </div>
              </div>
            )}

            {/* Submission Error Message */}
            {submissionError && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                  <h3 className="text-xl font-semibold text-red-800">Submission Failed</h3>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <p className="text-red-700">{submissionError}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 mb-6">
                  <h4 className="font-semibold text-blue-800 mb-3">💡 What to try:</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-blue-700">
                      <span className="text-blue-500 mt-1">•</span>
                      <span className="text-sm">Check your internet connection</span>
                    </li>
                    <li className="flex items-start gap-2 text-blue-700">
                      <span className="text-blue-500 mt-1">•</span>
                      <span className="text-sm">Try recording and submitting again</span>
                    </li>
                    <li className="flex items-start gap-2 text-blue-700">
                      <span className="text-blue-500 mt-1">•</span>
                      <span className="text-sm">Contact your teacher if the problem continues</span>
                    </li>
                  </ul>
                </div>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleClearMessages}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600">
          <p>Good luck with your assignment, {session.student?.full_name}! 📚</p>
        </div>
      </footer>
    </div>
  );
};