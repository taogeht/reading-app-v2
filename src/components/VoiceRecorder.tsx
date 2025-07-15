import React, { useState } from 'react';
import { Mic, Square, RotateCcw, Play, Pause, Upload, Send } from 'lucide-react';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { formatDuration } from '../utils/audioAnalysis';
import { Story } from '../types';

interface VoiceRecorderProps {
  story: Story;
  onRecordingSubmit: (audioBlob: Blob, metadata: {
    storyId: string;
    duration: number;
    submittedAt: string;
  }) => void;
  highlightedWordIndex: number;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  story,
  onRecordingSubmit,
  highlightedWordIndex,
}) => {
  const { recordingState, startRecording, stopRecording, resetRecording } = useAudioRecording();
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const words = story.text.split(/\s+/);

  const handleStartRecording = async () => {
    await startRecording();
    setHasRecorded(true);
    // Clean up previous audio URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    // Create audio URL for preview when recording stops
    if (recordingState.audioBlob) {
      const url = URL.createObjectURL(recordingState.audioBlob);
      setAudioUrl(url);
    }
  };

  const handleResetRecording = () => {
    resetRecording();
    setHasRecorded(false);
    setIsPlaying(false);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const handlePlayPreview = () => {
    if (recordingState.audioBlob && !audioUrl) {
      const url = URL.createObjectURL(recordingState.audioBlob);
      setAudioUrl(url);
    }
    
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
      setIsPlaying(true);
      
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
    }
  };

  const handleSubmitRecording = async () => {
    if (!recordingState.audioBlob) return;
    
    setIsSubmitting(true);
    
    try {
      const metadata = {
        storyId: story.id,
        duration: recordingState.duration,
        submittedAt: new Date().toISOString()
      };
      
      await onRecordingSubmit(recordingState.audioBlob, metadata);
      
      // Clean up after successful submission
      handleResetRecording();
    } catch (error) {
      console.error('Error submitting recording:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-100 rounded-xl">
          <Mic className="h-6 w-6 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Record Your Reading</h2>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">{story.title}</h3>
        <div className="text-lg leading-relaxed text-gray-700">
          {words.map((word, index) => (
            <span
              key={index}
              className={`transition-colors duration-200 ${
                index === highlightedWordIndex && recordingState.isRecording
                  ? 'bg-red-200 text-gray-900 px-1 rounded'
                  : ''
              }`}
            >
              {word}{' '}
            </span>
          ))}
        </div>
      </div>

      {/* Recording Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {!recordingState.isRecording ? (
            <button
              onClick={handleStartRecording}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 font-medium"
              disabled={isSubmitting}
            >
              <Mic className="h-5 w-5" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 font-medium animate-pulse"
            >
              <Square className="h-5 w-5" />
              Stop Recording
            </button>
          )}

          {hasRecorded && !recordingState.isRecording && !isSubmitting && (
            <button
              onClick={handleResetRecording}
              className="flex items-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all duration-200"
            >
              <RotateCcw className="h-5 w-5" />
              Record Again
            </button>
          )}
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-600">Duration</div>
          <div className="text-2xl font-mono font-bold text-gray-800">
            {formatDuration(recordingState.duration)}
          </div>
        </div>
      </div>

      {/* Recording Status */}
      {recordingState.isRecording && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-red-700 font-medium">Recording in progress... Read the story aloud!</span>
        </div>
      )}

      {/* Preview and Submit Section */}
      {recordingState.audioBlob && !recordingState.isRecording && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-700 font-medium">✅ Recording completed successfully!</span>
            </div>
            <p className="text-green-600 text-sm">
              Duration: {formatDuration(recordingState.duration)} • Ready to preview and submit
            </p>
          </div>

          {/* Preview Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-semibold text-blue-800 mb-3">🎧 Preview Your Recording</h4>
            <div className="flex items-center gap-4">
              <button
                onClick={handlePlayPreview}
                disabled={isPlaying}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-all duration-200"
              >
                <Play className="h-4 w-4" />
                {isPlaying ? 'Playing...' : 'Play Preview'}
              </button>
              <span className="text-blue-700 text-sm">
                Listen to your recording before submitting
              </span>
            </div>
          </div>

          {/* Submit Section */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <h4 className="font-semibold text-purple-800 mb-3">📤 Submit to Teacher</h4>
            <div className="flex items-center justify-between">
              <div className="text-purple-700 text-sm">
                Your recording will be saved for your teacher to review
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitRecording}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl hover:from-purple-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                >
                  {isSubmitting ? (
                    <>
                      <Upload className="h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Submit Recording
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Waveform Placeholder */}
      {recordingState.isRecording && (
        <div className="mt-6 p-4 bg-gray-100 rounded-xl">
          <div className="flex items-center justify-center gap-1 h-16">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-red-400 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 40 + 10}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <div className="text-center text-sm text-gray-600 mt-2">
            Audio levels - Keep talking!
          </div>
        </div>
      )}
    </div>
  );
};