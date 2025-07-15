interface SpeechRecognitionConfig {
  encoding: string;
  sampleRateHertz: number;
  languageCode: string;
  enableWordTimeOffsets: boolean;
  enableWordConfidence: boolean;
  enableAutomaticPunctuation: boolean;
  model: string;
}

interface RecognitionAudio {
  content: string; // Base64 encoded audio
}

interface SpeechRecognitionRequest {
  config: SpeechRecognitionConfig;
  audio: RecognitionAudio;
}

interface WordInfo {
  startTime: string;
  endTime: string;
  word: string;
  confidence: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
  words: WordInfo[];
}

interface SpeechRecognitionResult {
  alternatives: SpeechRecognitionAlternative[];
}

interface SpeechRecognitionResponse {
  results: SpeechRecognitionResult[];
}

class GoogleSpeechService {
  private apiKey: string;
  private baseUrl = 'https://speech.googleapis.com/v1/speech:recognize';

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;
    if (!this.apiKey) {
      console.warn('Google Cloud API key not found. Speech recognition will use fallback method.');
    }
  }

  private async audioToBase64(audioBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/wav;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  }

  private async resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.ceil(audioBuffer.length * targetSampleRate / audioBuffer.sampleRate),
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    return await offlineContext.startRendering();
  }

  private async convertToWav(audioBlob: Blob): Promise<{ blob: Blob; sampleRate: number }> {
    // Create audio context for conversion
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Use a standard sample rate that Google Speech API supports
      const targetSampleRate = 16000; // 16kHz is widely supported
      
      let processedBuffer = audioBuffer;
      
      // Resample if necessary
      if (audioBuffer.sampleRate !== targetSampleRate) {
        console.log(`Resampling from ${audioBuffer.sampleRate}Hz to ${targetSampleRate}Hz`);
        processedBuffer = await this.resampleAudio(audioBuffer, targetSampleRate);
      }
      
      // Convert to WAV format
      const wavBuffer = this.audioBufferToWav(processedBuffer);
      return {
        blob: new Blob([wavBuffer], { type: 'audio/wav' }),
        sampleRate: targetSampleRate
      };
    } catch (error) {
      console.error('Error converting audio:', error);
      // Return original blob with standard sample rate if conversion fails
      return {
        blob: audioBlob,
        sampleRate: 16000 // Use standard rate as fallback
      };
    } finally {
      audioContext.close();
    }
  }

  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length;
    const numberOfChannels = Math.min(buffer.numberOfChannels, 1); // Force mono for better compatibility
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true); // 16-bit samples
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert audio data to mono if needed
    let offset = 44;
    for (let i = 0; i < length; i++) {
      let sample = 0;
      
      if (numberOfChannels === 1) {
        // Use first channel or mix all channels to mono
        if (buffer.numberOfChannels === 1) {
          sample = buffer.getChannelData(0)[i];
        } else {
          // Mix all channels to mono
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            sample += buffer.getChannelData(channel)[i];
          }
          sample /= buffer.numberOfChannels;
        }
      }
      
      // Clamp and convert to 16-bit integer
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
    
    return arrayBuffer;
  }

  async recognizeSpeech(audioBlob: Blob): Promise<{
    transcript: string;
    words: WordInfo[];
    confidence: number;
  }> {
    if (!this.apiKey) {
      throw new Error('Google Cloud API key not configured');
    }

    try {
      // Convert audio to WAV format with proper sample rate
      const { blob: wavBlob, sampleRate } = await this.convertToWav(audioBlob);
      const base64Audio = await this.audioToBase64(wavBlob);

      const request: SpeechRecognitionRequest = {
        config: {
          encoding: 'LINEAR16', // Use LINEAR16 for WAV files
          sampleRateHertz: sampleRate, // Use the resampled rate
          languageCode: 'en-US',
          enableWordTimeOffsets: true,
          enableWordConfidence: true,
          enableAutomaticPunctuation: true,
          model: 'latest_long', // Good for reading assessment
        },
        audio: {
          content: base64Audio,
        },
      };

      console.log(`Sending audio with sample rate: ${sampleRate}Hz`);

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Google Speech API Error Response:', errorData);
        
        if (response.status === 400) {
          throw new Error(`Invalid request: ${errorData.error?.message || 'Bad request'}`);
        } else if (response.status === 401) {
          throw new Error('Invalid API key. Please check your Google Cloud API key.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Speech recognition failed: ${response.statusText}`);
        }
      }

      const data: SpeechRecognitionResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error('No speech recognized in the audio');
      }

      const result = data.results[0];
      const alternative = result.alternatives[0];

      return {
        transcript: alternative.transcript,
        words: alternative.words || [],
        confidence: alternative.confidence || 0,
      };
    } catch (error) {
      console.error('Google Speech API Error:', error);
      throw error;
    }
  }

  async analyzeReading(audioBlob: Blob, originalText: string): Promise<{
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
  }> {
    try {
      const recognition = await this.recognizeSpeech(audioBlob);
      const originalWords = originalText.toLowerCase().split(/\s+/).filter(word => word.length > 0);
      const spokenWords = recognition.transcript.toLowerCase().split(/\s+/).filter(word => word.length > 0);

      // Analyze word-by-word accuracy with transcription
      const wordAnalysis = this.compareWordsWithTranscription(originalWords, spokenWords, recognition.words);
      
      // Calculate overall accuracy
      const correctWords = wordAnalysis.filter(w => w.status === 'correct').length;
      const overallAccuracy = Math.round((correctWords / originalWords.length) * 100);

      // Analyze reading pace
      const readingPace = this.analyzeReadingPace(recognition.words, originalWords.length);

      // Analyze pauses
      const pauseAnalysis = this.analyzePauses(recognition.words);

      return {
        transcript: recognition.transcript,
        wordAnalysis,
        overallAccuracy,
        readingPace,
        pauseAnalysis,
      };
    } catch (error) {
      console.error('Error analyzing reading:', error);
      throw error;
    }
  }

  private compareWordsWithTranscription(
    originalWords: string[],
    spokenWords: string[],
    wordTimings: WordInfo[]
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
      const wordTiming = wordTimings[spokenIndex];

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
          confidence: wordTiming?.confidence,
          timing: wordTiming ? {
            startTime: parseFloat(wordTiming.startTime.replace('s', '')),
            endTime: parseFloat(wordTiming.endTime.replace('s', '')),
          } : undefined,
        });
        spokenIndex++;
      } else {
        // Word doesn't match - show what was actually said
        result.push({
          word: originalWord,
          spokenWord: spokenWord,
          status: 'incorrect' as const,
          confidence: wordTiming?.confidence,
        });
        spokenIndex++;
      }
    }

    // Handle any extra words that were spoken but not in the original text
    while (spokenIndex < spokenWords.length) {
      const extraWord = spokenWords[spokenIndex];
      const wordTiming = wordTimings[spokenIndex];
      
      result.push({
        word: `[extra: ${extraWord}]`,
        spokenWord: extraWord,
        status: 'extra' as const,
        confidence: wordTiming?.confidence,
      });
      spokenIndex++;
    }

    return result;
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

  private analyzeReadingPace(words: WordInfo[], expectedWordCount: number): 'too-fast' | 'just-right' | 'too-slow' {
    if (words.length === 0) return 'just-right';

    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    
    const startTime = parseFloat(firstWord.startTime.replace('s', ''));
    const endTime = parseFloat(lastWord.endTime.replace('s', ''));
    const duration = endTime - startTime;

    // Calculate words per minute
    const wordsPerMinute = (words.length / duration) * 60;

    // Age-appropriate reading speeds (words per minute)
    // For ages 7-15, typical reading speeds range from 80-200 WPM
    const idealMinWPM = 100;
    const idealMaxWPM = 180;

    if (wordsPerMinute < idealMinWPM) return 'too-slow';
    if (wordsPerMinute > idealMaxWPM) return 'too-fast';
    return 'just-right';
  }

  private analyzePauses(words: WordInfo[]): { count: number; locations: number[] } {
    const pauseLocations = [];
    let pauseCount = 0;

    for (let i = 1; i < words.length; i++) {
      const prevEndTime = parseFloat(words[i - 1].endTime.replace('s', ''));
      const currentStartTime = parseFloat(words[i].startTime.replace('s', ''));
      const gap = currentStartTime - prevEndTime;

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
}

export const googleSpeechService = new GoogleSpeechService();