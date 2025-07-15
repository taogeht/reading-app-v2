import { FeedbackData } from '../types';
import { whisperService } from '../services/whisperService';

export const analyzeRecording = async (
  audioBlob: Blob,
  originalText: string
): Promise<FeedbackData> => {
  try {
    console.log('Analyzing recording with local Whisper service...');
    const analysis = await whisperService.analyzeReading(audioBlob, originalText);
    
    // Convert Whisper analysis to our FeedbackData format
    const correctWords = analysis.wordAnalysis
      .filter(w => w.status === 'correct')
      .map(w => w.word);
    
    const incorrectWords = analysis.wordAnalysis
      .filter(w => w.status === 'incorrect')
      .map(w => w.word);
    
    const missedWords = analysis.wordAnalysis
      .filter(w => w.status === 'missed')
      .map(w => w.word);

    // Create detailed word analysis for the UI
    const wordAnalysis = analysis.wordAnalysis.map(item => ({
      originalWord: item.word,
      spokenWord: item.spokenWord,
      status: item.status,
      confidence: item.confidence,
      timing: item.timing
    }));

    // Assess analysis quality based on confidence and fluency
    const getAnalysisQuality = (fluency: number): 'excellent' | 'good' | 'fair' | 'poor' => {
      if (fluency >= 80) return 'excellent';
      if (fluency >= 60) return 'good';
      if (fluency >= 40) return 'fair';
      return 'poor';
    };

    console.log('Whisper analysis completed successfully');
    return {
      correctWords,
      incorrectWords,
      missedWords,
      readingPace: analysis.readingPace,
      pauseCount: analysis.pauseAnalysis.count,
      accuracy: analysis.overallAccuracy,
      transcript: analysis.transcript,
      wordAnalysis,
      wordsPerMinute: analysis.wordsPerMinute,
      fluencyScore: analysis.fluencyScore,
      analysisQuality: getAnalysisQuality(analysis.fluencyScore),
    };
  } catch (error) {
    console.error('Whisper service failed:', error);
    
    // Throw user-friendly error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('No speech recognized') || errorMessage.includes('File must be an audio file')) {
      throw new Error('It sounds like no speech was detected in your recording. Please try recording again and speak clearly into your microphone.');
    } else if (errorMessage.includes('audio too short')) {
      throw new Error('Your recording seems too short. Please try reading the entire story and record for a longer duration.');
    } else if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('Failed to fetch')) {
      throw new Error('Unable to connect to the speech analysis server. Please check that the Whisper server is running and try again.');
    } else if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
      throw new Error('The analysis is taking longer than expected. Please try with a shorter recording or try again later.');
    } else {
      throw new Error('We had trouble analyzing your recording. Please ensure the Whisper server is running and try again.');
    }
  }
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getReadingPaceColor = (pace: string): string => {
  switch (pace) {
    case 'too-fast': return 'text-orange-600';
    case 'too-slow': return 'text-blue-600';
    default: return 'text-green-600';
  }
};

export const getReadingPaceMessage = (pace: string): string => {
  switch (pace) {
    case 'too-fast': return 'Try reading a bit slower for better understanding';
    case 'too-slow': return 'You can try reading a little faster';
    default: return 'Perfect reading pace! Well done!';
  }
};