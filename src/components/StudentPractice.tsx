import React, { useState, useEffect } from 'react';
import { BookOpen, User, LogOut } from 'lucide-react';
import { useStudentAuth } from '../contexts/StudentAuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { StoryManager } from './StoryManager';
import { VoiceSettings } from './VoiceSettings';
import { TTSPlayer } from './TTSPlayer';
import { AudioRecorder } from './AudioRecorder';
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

  const handleRecordingComplete = (recording: any) => {
    console.log('Recording completed:', recording);
    // The AudioRecorder component handles success messages internally
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

            {/* Audio Recorder */}
            <AudioRecorder
              assignmentId={assignmentId || selectedStory.id}
              studentId={session.student_id}
              attemptNumber={1}
              onRecordingComplete={handleRecordingComplete}
            />
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