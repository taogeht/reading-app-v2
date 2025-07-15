import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, Square, Volume2, Loader2, DollarSign, FileAudio } from 'lucide-react';
import { Story, VoiceSettings } from '../types';
import { elevenLabsService } from '../services/elevenLabsService';
import { audioLibraryService } from '../services/audioLibraryService';

interface TTSPlayerProps {
  story: Story;
  voiceSettings: VoiceSettings;
  onWordHighlight: (wordIndex: number) => void;
}

export const TTSPlayer: React.FC<TTSPlayerProps> = ({
  story,
  voiceSettings,
  onWordHighlight,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoiceInfo, setSelectedVoiceInfo] = useState<{
    name: string;
    category: string;
    cost: string;
  } | null>(null);
  const [usingStaticAudio, setUsingStaticAudio] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const words = story.text.split(/\s+/);

  // Get voice info when settings change
  useEffect(() => {
    const getVoiceInfo = async () => {
      try {
        // Check if static audio is available first
        const isStaticAvailable = await audioLibraryService.checkAudioAvailability(
          story.id, 
          story.gradeLevel, 
          voiceSettings
        );
        
        setUsingStaticAudio(isStaticAvailable);
        
        if (isStaticAvailable) {
          const voiceInfo = audioLibraryService.getVoiceInfo(voiceSettings);
          setSelectedVoiceInfo({
            name: voiceInfo.name,
            category: 'static',
            cost: 'Free'
          });
        } else {
          // Fallback to ElevenLabs
          const voices = await elevenLabsService.getVoices();
          const voiceId = await elevenLabsService.findBestVoice(voiceSettings.accent, voiceSettings.gender);
          const voice = voices.find(v => v.voice_id === voiceId);
          
          if (voice) {
            setSelectedVoiceInfo({
              name: voice.name,
              category: voice.category,
              cost: voice.category === 'turbo' ? 'Budget' : 'Premium'
            });
          }
        }
      } catch (error) {
        console.error('Error getting voice info:', error);
        setUsingStaticAudio(false);
      }
    };

    getVoiceInfo();
  }, [voiceSettings, story.id, story.gradeLevel]);

  const simulateLoadingProgress = useCallback(() => {
    setLoadingProgress(0);
    setLoadingMessage('Preparing your story...');
    
    const messages = [
      'Preparing your story...',
      'Analyzing text content...',
      'Selecting the perfect voice...',
      'Generating natural speech...',
      'Processing audio quality...',
      'Almost ready to play...'
    ];
    
    let progress = 0;
    let messageIndex = 0;
    
    progressIntervalRef.current = setInterval(() => {
      progress += Math.random() * 15 + 5; // Random progress between 5-20%
      
      if (progress > 100) {
        progress = 95; // Don't complete until actual audio is ready
      }
      
      // Update message every ~20% progress
      const newMessageIndex = Math.floor(progress / 20);
      if (newMessageIndex !== messageIndex && newMessageIndex < messages.length) {
        messageIndex = newMessageIndex;
        setLoadingMessage(messages[messageIndex]);
      }
      
      setLoadingProgress(progress);
      
      // Stop at 95% and wait for actual completion
      if (progress >= 95) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setLoadingMessage('Finalizing audio...');
      }
    }, 800); // Update every 800ms for smooth progress
  }, []);

  const completeLoading = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setLoadingProgress(100);
    setLoadingMessage('Ready to play!');
    
    // Brief delay to show completion
    setTimeout(() => {
      setIsLoading(false);
      setLoadingProgress(0);
      setLoadingMessage('');
    }, 500);
  }, []);

  const simulateWordHighlighting = useCallback((duration: number) => {
    const wordsPerSecond = words.length / (duration / 1000);
    const intervalTime = 1000 / wordsPerSecond;
    let wordIndex = 0;

    intervalRef.current = setInterval(() => {
      if (wordIndex < words.length) {
        setCurrentWordIndex(wordIndex);
        onWordHighlight(wordIndex);
        wordIndex++;
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setCurrentWordIndex(-1);
        onWordHighlight(-1);
      }
    }, intervalTime);
  }, [words.length, onWordHighlight]);

  const playAudio = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCurrentWordIndex(-1);
      onWordHighlight(-1);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      let audioUrl: string | null = null;
      let needsCleanup = false;

      // Try static audio first
      if (usingStaticAudio) {
        setLoadingMessage('Loading story audio...');
        setLoadingProgress(50);
        
        audioUrl = await audioLibraryService.getAudioUrl(
          story.id,
          story.gradeLevel,
          voiceSettings
        );
        
        if (audioUrl) {
          setLoadingProgress(100);
          setLoadingMessage('Ready to play!');
        }
      }

      // Fallback to API if static audio not available
      if (!audioUrl) {
        setUsingStaticAudio(false);
        simulateLoadingProgress();
        
        const audioBlob = await elevenLabsService.generateSpeech(
          story.text,
          voiceSettings.accent,
          voiceSettings.gender
        );

        audioUrl = URL.createObjectURL(audioBlob);
        needsCleanup = true;
      }

      completeLoading();

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setIsPlaying(true);
        audio.play();
        simulateWordHighlighting(audio.duration * 1000);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentWordIndex(-1);
        onWordHighlight(-1);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (needsCleanup && audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
      };

      audio.onerror = () => {
        setIsLoading(false);
        setIsPlaying(false);
        setError('Failed to play audio');
        if (needsCleanup && audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      };

    } catch (error) {
      setIsLoading(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('Invalid API key')) {
        setError('ElevenLabs API key is invalid. Please check your API key in the .env file.');
      } else if (errorMessage.includes('Rate limit')) {
        setError('Rate limit exceeded. Please wait a moment and try again.');
      } else if (errorMessage.includes('not configured')) {
        setError('ElevenLabs API key not found. Please add your API key to the .env file.');
      } else {
        setError(`Failed to generate speech: ${errorMessage}`);
      }
      
      console.error('TTS Error:', error);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentWordIndex(-1);
    onWordHighlight(-1);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-orange-100 rounded-xl">
          <Volume2 className="h-6 w-6 text-orange-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Listen to the Story</h2>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">{story.title}</h3>
        <div className="text-lg leading-relaxed text-gray-700">
          {words.map((word, index) => (
            <span
              key={index}
              className={`transition-colors duration-200 ${
                index === currentWordIndex
                  ? 'bg-yellow-300 text-gray-900 px-1 rounded'
                  : ''
              }`}
            >
              {word}{' '}
            </span>
          ))}
        </div>
      </div>

      {/* Loading Progress */}
      {isLoading && (
        <div className="mb-6 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="h-6 w-6 text-orange-600 animate-spin" />
            <div>
              <h4 className="text-lg font-semibold text-gray-800">Generating Speech</h4>
              <p className="text-orange-700 font-medium">{loadingMessage}</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-orange-200 rounded-full h-3 mb-3">
            <div 
              className="bg-gradient-to-r from-orange-500 to-yellow-500 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>Processing your story with ElevenLabs AI...</span>
            <span>{Math.round(loadingProgress)}%</span>
          </div>
          
          <div className="mt-3 text-xs text-gray-500 text-center">
            ⏱️ This may take 10-30 seconds depending on story length
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-red-500 rounded-full flex-shrink-0 mt-0.5"></div>
            <div>
              <p className="text-red-700 font-medium mb-1">Audio Generation Failed</p>
              <p className="text-red-600 text-sm">{error}</p>
              {error.includes('API key') && (
                <div className="mt-2 text-xs text-red-500">
                  💡 Make sure your ElevenLabs API key is correctly set in your .env file as VITE_ELEVENLABS_API_KEY
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={playAudio}
          disabled={isLoading}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
            isLoading
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : isPlaying
              ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg'
              : 'bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl transform hover:scale-105'
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
          {isLoading ? 'Generating...' : isPlaying ? 'Pause' : 'Play Story'}
        </button>

        <button
          onClick={stopAudio}
          disabled={!isPlaying || isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Square className="h-5 w-5" />
          Stop
        </button>

        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
          <span>Voice: {voiceSettings.gender} ({voiceSettings.accent})</span>
          {selectedVoiceInfo && (
            <>
              <span>•</span>
              <span className="font-medium">{selectedVoiceInfo.name}</span>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                selectedVoiceInfo.cost === 'Free' 
                  ? 'bg-blue-100 text-blue-700' 
                  : selectedVoiceInfo.cost === 'Budget' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {usingStaticAudio ? (
                  <FileAudio className="h-3 w-3" />
                ) : (
                  <DollarSign className="h-3 w-3" />
                )}
                {selectedVoiceInfo.cost}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>
            {usingStaticAudio 
              ? '🎵 Using pre-recorded high-quality audio' 
              : 'Powered by ElevenLabs AI - High-quality natural speech synthesis'
            }
          </span>
          {!usingStaticAudio && selectedVoiceInfo?.cost === 'Budget' && (
            <span className="text-green-600 font-medium">💰 Using cost-optimized Turbo voice</span>
          )}
          {usingStaticAudio && (
            <span className="text-blue-600 font-medium">⚡ Lightning-fast loading</span>
          )}
        </div>
      </div>
    </div>
  );
};