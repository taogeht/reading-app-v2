export interface Story {
  id: string;
  title: string;
  text: string;
  gradeLevel: number;
  subject: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  wordCount: number;
  themes: string[];
  readingLevel: string;
}

export interface VoiceSettings {
  accent: 'USA' | 'UK';
  gender: 'Male' | 'Female';
}

export interface FeedbackData {
  correctWords: string[];
  incorrectWords: string[];
  missedWords: string[];
  readingPace: 'too-fast' | 'just-right' | 'too-slow';
  pauseCount: number;
  accuracy: number;
  transcript: string;
  wordAnalysis: Array<{
    originalWord: string;
    spokenWord?: string;
    status: 'correct' | 'incorrect' | 'missed' | 'extra';
    confidence?: number;
    timing?: {
      startTime: number;
      endTime: number;
    };
  }>;
  // Enhanced Whisper analysis data
  wordsPerMinute?: number;
  fluencyScore?: number;
  analysisQuality?: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
}