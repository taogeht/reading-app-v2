import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Upload, Trash2 } from 'lucide-react';
import { recordingService } from '../services/railwayDatabaseService';

interface AudioRecorderProps {
  assignmentId: string;
  studentId: string;
  attemptNumber?: number;
  onRecordingComplete?: (recording: any) => void;
  className?: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  assignmentId,
  studentId,
  attemptNumber = 1,
  onRecordingComplete,
  className = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        
        // Create URL for playback
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err: any) {
      setError('Failed to access microphone: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const playRecording = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const uploadRecording = async () => {
    if (!audioBlob) return;

    setUploading(true);
    setError(null);

    try {
      // Convert blob to base64 or FormData - for now we'll use a mock URL
      const audioUrl = `recording_${Date.now()}_${studentId}_${assignmentId}.wav`;
      const audioFilename = `recording_attempt_${attemptNumber}.wav`;
      
      const recordingData = {
        student_id: studentId,
        assignment_id: assignmentId,
        attempt_number: attemptNumber,
        audio_url: audioUrl,
        audio_filename: audioFilename,
        audio_size_bytes: audioBlob.size,
        audio_duration_seconds: recordingTime,
        status: 'uploaded' as const,
      };

      const result = await recordingService.create(recordingData);
      
      if (result) {
        console.log('Recording uploaded successfully:', result);
        onRecordingComplete?.(result);
        
        // Reset component state
        deleteRecording();
        alert('Recording uploaded successfully!');
      } else {
        setError('Failed to upload recording. Please try again.');
      }
    } catch (err: any) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Audio Recorder</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Recording Timer */}
        <div className="mb-4 text-2xl font-mono text-gray-700">
          {formatTime(recordingTime)}
        </div>

        {/* Recording Controls */}
        <div className="flex justify-center gap-4 mb-6">
          {!isRecording && !audioBlob && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Mic className="h-5 w-5" />
              Start Recording
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Square className="h-5 w-5" />
              Stop Recording
            </button>
          )}
        </div>

        {/* Playback Controls */}
        {audioBlob && audioUrl && (
          <>
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            
            <div className="flex justify-center gap-3 mb-6">
              {!isPlaying ? (
                <button
                  onClick={playRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Play
                </button>
              ) : (
                <button
                  onClick={pauseRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </button>
              )}

              <button
                onClick={deleteRecording}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>

              <button
                onClick={uploadRecording}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Submit'}
              </button>
            </div>
          </>
        )}

        {/* Status Messages */}
        {isRecording && (
          <div className="text-sm text-red-600 animate-pulse">
            🔴 Recording in progress...
          </div>
        )}

        {uploading && (
          <div className="text-sm text-blue-600">
            📤 Uploading recording...
          </div>
        )}
      </div>
    </div>
  );
};