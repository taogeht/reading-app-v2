interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
}

interface WhisperResponse {
  text: string;
  language: string;
  confidence: number;
  segments: WhisperSegment[];
  duration: number;
  words_per_minute: number;
  pause_count: number;
  fluency_score: number;
}

interface WhisperAnalysisResult {
  transcript: string;
  wordAnalysis: {
    word: string;
    spokenWord?: string;
    status: 'correct' | 'incorrect' | 'missed' | 'extra';
    confidence?: number;
    timing?: {
      startTime: number;
      endTime: number;
    };
  }[];
  overallAccuracy: number;
  readingPace: 'too-fast' | 'just-right' | 'too-slow';
  pauseAnalysis: {
    count: number;
    locations: number[];
  };
  fluencyScore: number;
  wordsPerMinute: number;
}

class WhisperService {
  private baseUrl: string;
  private timeout: number = 300000; // 5 minutes timeout

  constructor(baseUrl?: string) {
    // Try to get URL from environment variable or use provided URL
    this.baseUrl = baseUrl || 
                  import.meta.env.VITE_WHISPER_SERVER_URL || 
                  'http://localhost:8000';
    
    console.log(`WhisperService initialized with URL: ${this.baseUrl}`);
  }

  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Whisper health check failed:', error);
      return false;
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<WhisperResponse> {
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'audio.wav');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Whisper transcription failed: ${errorData.detail || response.statusText}`);
      }

      const data: WhisperResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw error;
    }
  }

  async analyzeReading(audioBlob: Blob, originalText: string): Promise<WhisperAnalysisResult> {
    try {
      const whisperResponse = await this.transcribeAudio(audioBlob);
      
      const originalWords = originalText.toLowerCase().split(/\s+/).filter(word => word.length > 0);
      const spokenWords = whisperResponse.text.toLowerCase().split(/\s+/).filter(word => word.length > 0);

      // Analyze word-by-word accuracy
      const wordAnalysis = this.compareWords(originalWords, spokenWords, whisperResponse.segments);
      
      // Calculate overall accuracy
      const correctWords = wordAnalysis.filter(w => w.status === 'correct').length;
      const overallAccuracy = Math.round((correctWords / originalWords.length) * 100);

      // Analyze reading pace based on expected vs actual duration
      const readingPace = this.analyzeReadingPace(whisperResponse.words_per_minute);

      // Extract pause analysis from Whisper response
      const pauseAnalysis = this.analyzePausesFromSegments(whisperResponse.segments);

      return {
        transcript: whisperResponse.text,
        wordAnalysis,
        overallAccuracy,
        readingPace,
        pauseAnalysis,
        fluencyScore: whisperResponse.fluency_score,
        wordsPerMinute: whisperResponse.words_per_minute,
      };
    } catch (error) {
      console.error('Error analyzing reading with Whisper:', error);
      throw error;
    }
  }

  private compareWords(
    originalWords: string[],
    spokenWords: string[],
    segments: WhisperSegment[]
  ): {
    word: string;
    spokenWord?: string;
    status: 'correct' | 'incorrect' | 'missed' | 'extra';
    confidence?: number;
    timing?: { startTime: number; endTime: number };
  }[] {
    const result = [];
    let spokenIndex = 0;

    for (let i = 0; i < originalWords.length; i++) {
      const originalWord = originalWords[i];
      const spokenWord = spokenWords[spokenIndex];
      
      // Find the segment containing this word
      const segment = this.findSegmentForWord(spokenIndex, segments, spokenWords);

      if (!spokenWord) {
        // Word was missed
        result.push({
          word: originalWord,
          status: 'missed' as const,
        });
      } else if (this.wordsMatch(originalWord, spokenWord)) {
        // Word matches
        result.push({
          word: originalWord,
          spokenWord: spokenWord,
          status: 'correct' as const,
          confidence: segment?.confidence,
          timing: segment ? {
            startTime: segment.start,
            endTime: segment.end,
          } : undefined,
        });
        spokenIndex++;
      } else {
        // Word doesn't match
        result.push({
          word: originalWord,
          spokenWord: spokenWord,
          status: 'incorrect' as const,
          confidence: segment?.confidence,
        });
        spokenIndex++;
      }
    }

    // Handle any extra words
    while (spokenIndex < spokenWords.length) {
      const extraWord = spokenWords[spokenIndex];
      const segment = this.findSegmentForWord(spokenIndex, segments, spokenWords);
      
      result.push({
        word: `[extra: ${extraWord}]`,
        spokenWord: extraWord,
        status: 'extra' as const,
        confidence: segment?.confidence,
      });
      spokenIndex++;
    }

    return result;
  }

  private findSegmentForWord(
    wordIndex: number,
    segments: WhisperSegment[],
    spokenWords: string[]
  ): WhisperSegment | undefined {
    // Simple approach: find segment that likely contains this word
    // This is approximate since Whisper segments are phrases, not individual words
    let wordCount = 0;
    for (const segment of segments) {
      const segmentWords = segment.text.split(/\s+/).filter(w => w.length > 0);
      if (wordIndex < wordCount + segmentWords.length) {
        return segment;
      }
      wordCount += segmentWords.length;
    }
    return segments[segments.length - 1]; // Return last segment as fallback
  }

  private wordsMatch(original: string, spoken: string): boolean {
    // Remove punctuation and normalize
    const normalize = (word: string) => word.replace(/[^\w]/g, '').toLowerCase();
    const normalizedOriginal = normalize(original);
    const normalizedSpoken = normalize(spoken);

    // Exact match
    if (normalizedOriginal === normalizedSpoken) return true;

    // Fuzzy match for common mispronunciations
    const similarity = this.calculateSimilarity(normalizedOriginal, normalizedSpoken);
    return similarity > 0.8; // 80% similarity threshold
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private analyzeReadingPace(wordsPerMinute: number): 'too-fast' | 'just-right' | 'too-slow' {
    // Age-appropriate reading speeds (words per minute)
    // For ages 7-15, typical reading speeds range from 80-200 WPM
    const idealMinWPM = 100;
    const idealMaxWPM = 180;

    if (wordsPerMinute < idealMinWPM) return 'too-slow';
    if (wordsPerMinute > idealMaxWPM) return 'too-fast';
    return 'just-right';
  }

  private analyzePausesFromSegments(segments: WhisperSegment[]): { count: number; locations: number[] } {
    const pauseLocations = [];
    let pauseCount = 0;

    for (let i = 1; i < segments.length; i++) {
      const prevEnd = segments[i - 1].end;
      const currentStart = segments[i].start;
      const gap = currentStart - prevEnd;

      // Consider gaps longer than 0.5 seconds as pauses
      if (gap > 0.5) {
        pauseCount++;
        pauseLocations.push(i);
      }
    }

    return {
      count: pauseCount,
      locations: pauseLocations,
    };
  }

  // Configuration methods
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  setTimeout(timeoutMs: number): void {
    this.timeout = timeoutMs;
  }

  // Quality assessment methods
  assessTranscriptionQuality(response: WhisperResponse): 'excellent' | 'good' | 'fair' | 'poor' {
    const avgConfidence = response.confidence;
    
    if (avgConfidence > 0.9) return 'excellent';
    if (avgConfidence > 0.7) return 'good';
    if (avgConfidence > 0.5) return 'fair';
    return 'poor';
  }

  // Format results for display
  formatAnalysisForDisplay(analysis: WhisperAnalysisResult): {
    summary: string;
    details: string[];
    recommendations: string[];
  } {
    const summary = `Accuracy: ${analysis.overallAccuracy}% | WPM: ${analysis.wordsPerMinute} | Fluency: ${analysis.fluencyScore}%`;
    
    const details = [
      `Reading pace: ${analysis.readingPace}`,
      `Pauses detected: ${analysis.pauseAnalysis.count}`,
      `Words analyzed: ${analysis.wordAnalysis.length}`,
    ];

    const recommendations = [];
    if (analysis.readingPace === 'too-fast') {
      recommendations.push('Try reading more slowly for better comprehension');
    } else if (analysis.readingPace === 'too-slow') {
      recommendations.push('Practice reading more fluently');
    }

    if (analysis.pauseAnalysis.count > 5) {
      recommendations.push('Work on reading more smoothly with fewer pauses');
    }

    if (analysis.overallAccuracy < 80) {
      recommendations.push('Focus on accuracy - take time to read each word carefully');
    }

    return { summary, details, recommendations };
  }
}

export const whisperService = new WhisperService();