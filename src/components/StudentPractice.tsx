import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, AlertCircle, User, LogOut } from 'lucide-react';
import { useStudentAuth } from '../contexts/StudentAuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { StoryManager } from './StoryManager';
import { VoiceSettings } from './VoiceSettings';
import { TTSPlayer } from './TTSPlayer';
import { VoiceRecorder } from './VoiceRecorder';
import { RecordingUploadService, RecordingMetadata } from '../services/RecordingUploadService';
import { Story, VoiceSettings as VoiceSettingsType } from '../types';

export const StudentPractice: React.FC = () => {
  const { session, signOut } = useStudentAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsType>({
    accent: 'USA',
    gender: 'Female',
  });
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);

  // Load stories and check for URL parameters
  useEffect(() => {
    const loadStories = async () => {
      try {
        const response = await fetch('/stories.json');
        if (response.ok) {
          const storiesData = await response.json();
          setStories(storiesData);
          
          // Check if we have a story parameter from assignment
          const storyParam = searchParams.get('story');
          const assignmentParam = searchParams.get('assignment');
          
          if (storyParam) {
            const foundStory = storiesData.find((story: Story) => story.id === storyParam);
            if (foundStory) {
              console.log('Auto-selecting story from assignment:', foundStory.title);
              setSelectedStory(foundStory);
              setAssignmentId(assignmentParam);
            } else {
              console.warn('Story not found:', storyParam);
            }
          }
        }
      } catch (error) {
        console.error('Error loading stories:', error);
      }
    };
    
    loadStories();
  }, [searchParams]);

  // Redirect if not logged in as student
  if (!session) {
    navigate('/');
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleRecordingSubmit = async (audioBlob: Blob, metadata: RecordingMetadata) => {
    if (!session?.student_id || !session?.class_id) {
      setSubmissionError('Session information missing. Please log in again.');
      return;
    }

    setSubmissionError(null);
    setSubmissionSuccess(null);

    try {
      // Include assignment ID and story text for analysis
      const recordingMetadata: RecordingMetadata = {
        ...metadata,
        storyText: selectedStory?.text, // Include story text for analysis
        assignmentId: assignmentId || undefined
      };

      const result = await RecordingUploadService.uploadRecording(
        audioBlob,
        recordingMetadata,
        session.student_id,
        session.class_id
      );

      if (result.success) {
        setSubmissionSuccess(`Recording submitted successfully! Your teacher will review it soon.`);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Reading Practice</h1>
                <p className="text-gray-600">
                  {assignmentId ? 
                    `Assignment practice for ${session.student?.full_name}` : 
                    `Free practice for ${session.student?.full_name}`
                  }
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
                className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              >
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
        {/* Story Selection */}
        <StoryManager
          onStorySelect={setSelectedStory}
          selectedStory={selectedStory}
          initialStories={stories}
        />

        {selectedStory && (
          <>
            {/* Voice Settings */}
            <VoiceSettings
              settings={voiceSettings}
              onSettingsChange={setVoiceSettings}
            />

            {/* TTS Player */}
            <TTSPlayer
              story={selectedStory}
              voiceSettings={voiceSettings}
              onWordHighlight={setHighlightedWordIndex}
            />

            {/* Voice Recorder */}
            <VoiceRecorder
              story={selectedStory}
              onRecordingSubmit={handleRecordingSubmit}
              highlightedWordIndex={highlightedWordIndex}
            />

            {/* Submission Success Message */}
            {submissionSuccess && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <h3 className="text-xl font-semibold text-green-800">Recording Submitted!</h3>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-green-700">{submissionSuccess}</p>
                </div>
                <div className="flex justify-center mt-4">
                  <button
                    onClick={handleClearMessages}
                    className="px-4 py-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    Dismiss
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

        {/* Welcome Message */}
        {!selectedStory && (
          <div className="text-center py-16">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Choose a Story to Practice!</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Select any story above to practice reading. You can listen to it first, then record yourself reading to get feedback on your pronunciation and reading skills!
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600">
          <p>Happy reading, {session.student?.full_name}! 📚</p>
        </div>
      </footer>
    </div>
  );
};