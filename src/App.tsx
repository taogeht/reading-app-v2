import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { BookOpen, Sparkles, AlertCircle } from 'lucide-react';
import { UnifiedAuthProvider as AuthProvider, useAuth } from './contexts/UnifiedAuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UserProfile } from './components/UserProfile';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { ClassAccess } from './components/ClassAccess';
import { StudentAssignments } from './components/StudentAssignments';
import { StudentPractice } from './components/StudentPractice';
import { AssignmentPractice } from './components/AssignmentPractice';
import { StoryManager } from './components/StoryManager';
import { VoiceSettings } from './components/VoiceSettings';
import { TTSPlayer } from './components/TTSPlayer';
import { VoiceRecorder } from './components/VoiceRecorder';
import { FeedbackDisplay } from './components/FeedbackDisplay';
import { RoleRedirect } from './components/RoleRedirect';
import { WelcomePage } from './components/WelcomePage';
import { analyzeRecording } from './utils/audioAnalysis';
import { Story, VoiceSettings as VoiceSettingsType, FeedbackData } from './types';

const AppContent: React.FC = () => {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsType>({
    accent: 'USA',
    gender: 'Female',
  });
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'speech' | 'network' | 'general' | null>(null);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!selectedStory) return;

    setIsAnalyzing(true);
    setError(null);
    setErrorType(null);
    try {
      const feedbackData = await analyzeRecording(audioBlob, selectedStory.text);
      setFeedback(feedbackData);
    } catch (error) {
      console.error('Error analyzing recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while analyzing your recording.';
      
      // Categorize the error type for better UI handling
      if (errorMessage.includes('no speech') || errorMessage.includes('No speech recognized')) {
        setErrorType('speech');
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        setErrorType('network');
      } else {
        setErrorType('general');
      }
      
      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTryAgain = () => {
    setFeedback(null);
    setError(null);
    setErrorType(null);
    setHighlightedWordIndex(-1);
  };

  const getErrorIcon = () => {
    switch (errorType) {
      case 'speech':
        return '🎤';
      case 'network':
        return '🌐';
      default:
        return '⚠️';
    }
  };

  const getErrorTitle = () => {
    switch (errorType) {
      case 'speech':
        return 'No Speech Detected';
      case 'network':
        return 'Connection Problem';
      default:
        return 'Recording Analysis Error';
    }
  };

  const getErrorSuggestions = () => {
    switch (errorType) {
      case 'speech':
        return [
          'Make sure your microphone is working and not muted',
          'Speak clearly and loudly enough to be heard',
          'Check that your browser has microphone permissions',
          'Try moving closer to your microphone',
          'Make sure you\'re reading the story out loud during recording'
        ];
      case 'network':
        return [
          'Check your internet connection',
          'Try refreshing the page and recording again',
          'Make sure you\'re not on a restricted network'
        ];
      default:
        return [
          'Try recording again with clear speech',
          'Make sure your microphone is working properly',
          'Check your internet connection'
        ];
    }
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
                <h1 className="text-3xl font-bold text-gray-900">Reading & Recording Practice</h1>
                <p className="text-gray-600">Improve your reading skills with interactive practice</p>
              </div>
            </div>
            
            <UserProfile />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Story Selection */}
        <StoryManager
          onStorySelect={setSelectedStory}
          selectedStory={selectedStory}
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
            {!feedback && !error && (
              <VoiceRecorder
                story={selectedStory}
                onRecordingComplete={handleRecordingComplete}
                highlightedWordIndex={highlightedWordIndex}
              />
            )}

            {/* Analysis Loading */}
            {isAnalyzing && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Sparkles className="h-6 w-6 text-purple-600 animate-spin" />
                  <span className="text-xl font-semibold text-gray-800">Analyzing your reading...</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
                <p className="text-gray-600 mt-2">Please wait while we process your recording</p>
              </div>
            )}

            {/* Enhanced Error Display */}
            {error && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="text-4xl">{getErrorIcon()}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="h-6 w-6 text-red-500" />
                      <h3 className="text-xl font-semibold text-gray-800">{getErrorTitle()}</h3>
                    </div>
                    <p className="text-gray-700 mb-4">{error}</p>
                    
                    {/* Helpful suggestions */}
                    <div className="bg-blue-50 rounded-xl p-4 mb-6">
                      <h4 className="font-semibold text-blue-800 mb-3">💡 Here's how to fix this:</h4>
                      <ul className="space-y-2">
                        {getErrorSuggestions().map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-2 text-blue-700">
                            <span className="text-blue-500 mt-1">•</span>
                            <span className="text-sm">{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Microphone test for speech errors */}
                    {errorType === 'speech' && (
                      <div className="bg-yellow-50 rounded-xl p-4 mb-6 border border-yellow-200">
                        <h4 className="font-semibold text-yellow-800 mb-2">🔧 Quick Microphone Test</h4>
                        <p className="text-yellow-700 text-sm mb-3">
                          Try saying "Hello, can you hear me?" and see if your browser shows a microphone icon or indicator.
                        </p>
                        <div className="text-xs text-yellow-600">
                          If you don't see any microphone activity, check your browser settings and device permissions.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleTryAgain}
                    className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    Try Recording Again
                  </button>
                </div>
              </div>
            )}

            {/* Feedback Display */}
            {feedback && (
              <FeedbackDisplay
                feedback={feedback}
                story={selectedStory}
                onTryAgain={handleTryAgain}
              />
            )}
          </>
        )}

        {/* Welcome Message */}
        {!selectedStory && (
          <div className="text-center py-16">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome to Reading Practice!</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose a story above to get started. You can listen to it being read aloud, then record yourself reading it to get instant feedback on your pronunciation and reading skills!
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600">
          <p>Made with ❤️ for young readers everywhere</p>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Welcome/Landing page */}
          <Route path="/welcome" element={<WelcomePage />} />
          
          {/* Class access route - no auth required */}
          <Route path="/class/:accessToken" element={<ClassAccess />} />
          
          {/* Student routes - after visual password login */}
          <Route path="/assignments" element={<StudentAssignments />} />
          <Route path="/practice" element={<StudentPractice />} />
          <Route path="/assignment/:assignmentId" element={<AssignmentPractice />} />
          
          {/* Admin dashboard - requires admin role, no direct links to this */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requireAuth={true} allowedRoles={['admin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Teacher dashboard with direct login - requires teacher role */}
          <Route 
            path="/teacher" 
            element={
              <ProtectedRoute requireAuth={true} allowedRoles={['teacher']}>
                <TeacherDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Main app - requires auth */}
          <Route 
            path="/app" 
            element={
              <ProtectedRoute requireAuth={true}>
                <AppContent />
              </ProtectedRoute>
            } 
          />
          
          {/* Default redirect based on role */}
          <Route path="/" element={<RoleRedirect />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;