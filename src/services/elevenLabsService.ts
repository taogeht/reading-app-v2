interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: {
    accent?: string;
    gender?: string;
    age?: string;
  };
}

interface TTSRequest {
  text: string;
  voice_id: string;
  model_id?: string;
  voice_settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private voices: ElevenLabsVoice[] = [];

  constructor() {
    this.apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found. TTS functionality will be limited.');
    }
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 2000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Only retry on network errors, timeouts, or 5xx server errors
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          
          // Don't retry on clear authentication errors (401 status)
          if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            throw error;
          }
          
          // Don't retry on client errors (4xx except 429)
          if (errorMessage.includes('400') || 
              errorMessage.includes('403') || 
              errorMessage.includes('404') ||
              errorMessage.includes('422')) {
            throw error;
          }
        }

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Only retry on network errors, timeouts, or rate limits
        const shouldRetry = error instanceof Error && (
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('429') ||
          error.message.includes('5')
        );

        if (!shouldRetry) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(1.5, attempt);
        console.log(`Network error on attempt ${attempt + 1}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  async getVoices(): Promise<ElevenLabsVoice[]> {
    if (this.voices.length > 0) {
      return this.voices;
    }

    if (!this.apiKey) {
      console.warn('ElevenLabs API key not configured, using fallback voices');
      return this.getFallbackVoices();
    }

    try {
      const voices = await this.retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
          const response = await fetch(`${this.baseUrl}/voices`, {
            headers: {
              'xi-api-key': this.apiKey,
              'Accept': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            if (response.status === 401) {
              throw new Error('Authentication failed - please check your ElevenLabs API key');
            } else if (response.status === 429) {
              throw new Error('Rate limit exceeded - please wait before trying again');
            } else if (response.status >= 500) {
              throw new Error(`Server error (${response.status}) - please try again`);
            } else {
              throw new Error(`Request failed with status ${response.status}`);
            }
          }

          const data = await response.json();
          return data.voices || [];
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error('Request timed out - please check your connection');
          }
          throw fetchError;
        }
      });

      this.voices = voices;
      return this.voices;
    } catch (error) {
      console.warn('Could not fetch ElevenLabs voices, using fallback voices:', error);
      // Always return fallback voices to keep the app working
      return this.getFallbackVoices();
    }
  }

  private getFallbackVoices(): ElevenLabsVoice[] {
    return [
      // Premium voices (keep existing)
      {
        voice_id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        category: 'premade',
        labels: { accent: 'american', gender: 'female', age: 'young' }
      },
      {
        voice_id: 'VR6AewLTigWG4xSOukaG',
        name: 'Josh',
        category: 'premade',
        labels: { accent: 'american', gender: 'male', age: 'young' }
      },
      {
        voice_id: 'XB0fDUnXU5powFXDhCwa',
        name: 'Charlotte',
        category: 'premade',
        labels: { accent: 'british', gender: 'female', age: 'middle_aged' }
      },
      {
        voice_id: 'onwK4e9ZLuTAKqWW03F9',
        name: 'Daniel',
        category: 'premade',
        labels: { accent: 'british', gender: 'male', age: 'middle_aged' }
      },
      
      // Cheapest Turbo v2.5 voices (significantly lower cost)
      {
        voice_id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam (Turbo)',
        category: 'turbo',
        labels: { accent: 'american', gender: 'male', age: 'middle_aged' }
      },
      {
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Bella (Turbo)',
        category: 'turbo',
        labels: { accent: 'american', gender: 'female', age: 'young' }
      },
      {
        voice_id: 'ErXwobaYiN019PkySvjV',
        name: 'Antoni (Turbo)',
        category: 'turbo',
        labels: { accent: 'american', gender: 'male', age: 'young' }
      },
      {
        voice_id: 'MF3mGyEYCl7XYWbV9V6O',
        name: 'Elli (Turbo)',
        category: 'turbo',
        labels: { accent: 'american', gender: 'female', age: 'young' }
      },
      {
        voice_id: 'TxGEqnHWrfWFTfGW9XjX',
        name: 'Josh (Turbo)',
        category: 'turbo',
        labels: { accent: 'american', gender: 'male', age: 'young' }
      },
      {
        voice_id: 'VR6AewLTigWG4xSOukaG',
        name: 'Arnold (Turbo)',
        category: 'turbo',
        labels: { accent: 'american', gender: 'male', age: 'middle_aged' }
      },
      {
        voice_id: 'pqHfZKP75CvOlQylNhV4',
        name: 'Bill (Turbo)',
        category: 'turbo',
        labels: { accent: 'american', gender: 'male', age: 'middle_aged' }
      },
      {
        voice_id: 'nPczCjzI2devNBz1zQrb',
        name: 'Brian (Turbo)',
        category: 'turbo',
        labels: { accent: 'american', gender: 'male', age: 'middle_aged' }
      },
      {
        voice_id: 'N2lVS1w4EtoT3dr4eOWO',
        name: 'Callum (Turbo)',
        category: 'turbo',
        labels: { accent: 'british', gender: 'male', age: 'middle_aged' }
      },
      {
        voice_id: 'IKne3meq5aSn9XLyUdCD',
        name: 'Charlie (Turbo)',
        category: 'turbo',
        labels: { accent: 'australian', gender: 'male', age: 'middle_aged' }
      },
      {
        voice_id: 'XrExE9yKIg1WjnnlVkGX',
        name: 'Matilda (Turbo)',
        category: 'turbo',
        labels: { accent: 'american', gender: 'female', age: 'young' }
      }
    ];
  }

  async findBestVoice(accent: 'USA' | 'UK', gender: 'Male' | 'Female'): Promise<string> {
    const voices = await this.getVoices();
    
    // Predefined voice IDs prioritizing cheaper Turbo voices first, then premium
    const voiceMap: Record<string, string[]> = {
      'USA-Female': [
        'EXAVITQu4vr4xnSDxMaL', // Bella (Turbo) - cheapest
        'MF3mGyEYCl7XYWbV9V6O', // Elli (Turbo) - cheapest
        'XrExE9yKIg1WjnnlVkGX', // Matilda (Turbo) - cheapest
        '21m00Tcm4TlvDq8ikWAM'  // Rachel (Premium) - fallback
      ],
      'USA-Male': [
        'pNInz6obpgDQGcFmaJgB', // Adam (Turbo) - cheapest
        'ErXwobaYiN019PkySvjV', // Antoni (Turbo) - cheapest
        'TxGEqnHWrfWFTfGW9XjX', // Josh (Turbo) - cheapest
        'pqHfZKP75CvOlQylNhV4', // Bill (Turbo) - cheapest
        'nPczCjzI2devNBz1zQrb', // Brian (Turbo) - cheapest
        'VR6AewLTigWG4xSOukaG'  // Josh (Premium) - fallback
      ],
      'UK-Female': [
        'XB0fDUnXU5powFXDhCwa'  // Charlotte (Premium) - no cheap UK female available
      ],
      'UK-Male': [
        'N2lVS1w4EtoT3dr4eOWO', // Callum (Turbo) - cheapest
        'onwK4e9ZLuTAKqWW03F9'  // Daniel (Premium) - fallback
      ],
    };

    const key = `${accent}-${gender}`;
    const voiceOptions = voiceMap[key];
    
    if (voiceOptions && voiceOptions.length > 0) {
      // Return the first (cheapest) option
      return voiceOptions[0];
    }

    // Fallback: find voice by labels
    const targetAccent = accent.toLowerCase();
    const targetGender = gender.toLowerCase();

    // Prioritize turbo voices for cost savings
    const turboVoices = voices.filter(voice => voice.category === 'turbo');
    const matchingTurboVoice = turboVoices.find(voice => {
      const labels = voice.labels || {};
      const voiceAccent = labels.accent?.toLowerCase() || '';
      const voiceGender = labels.gender?.toLowerCase() || '';
      
      return (
        (voiceAccent.includes('american') && targetAccent === 'usa') ||
        (voiceAccent.includes('british') && targetAccent === 'uk') ||
        (voiceGender.includes(targetGender))
      );
    });

    if (matchingTurboVoice) {
      return matchingTurboVoice.voice_id;
    }

    // Final fallback to any matching voice
    const matchingVoice = voices.find(voice => {
      const labels = voice.labels || {};
      const voiceAccent = labels.accent?.toLowerCase() || '';
      const voiceGender = labels.gender?.toLowerCase() || '';
      
      return (
        (voiceAccent.includes('american') && targetAccent === 'usa') ||
        (voiceAccent.includes('british') && targetAccent === 'uk') ||
        (voiceGender.includes(targetGender))
      );
    });

    return matchingVoice?.voice_id || voices[0]?.voice_id || '21m00Tcm4TlvDq8ikWAM';
  }

  async generateSpeech(
    text: string,
    accent: 'USA' | 'UK',
    gender: 'Male' | 'Female'
  ): Promise<Blob> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured. Please add your API key to continue.');
    }

    const voiceId = await this.findBestVoice(accent, gender);
    
    // Determine if this is a turbo voice to use the cheaper model
    const voices = await this.getVoices();
    const selectedVoice = voices.find(v => v.voice_id === voiceId);
    const isTurboVoice = selectedVoice?.category === 'turbo';

    const requestBody: TTSRequest = {
      text,
      voice_id: voiceId,
      // Use turbo model for turbo voices (much cheaper), multilingual for premium voices
      model_id: isTurboVoice ? 'eleven_turbo_v2_5' : 'eleven_monolingual_v1',
      voice_settings: {
        stability: isTurboVoice ? 0.5 : 0.5,
        similarity_boost: isTurboVoice ? 0.8 : 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    };

    return await this.retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for TTS

      try {
        const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = `Request failed with status ${response.status}`;
          
          try {
            const errorData = await response.json();
            if (errorData.detail && errorData.detail.message) {
              errorMessage = errorData.detail.message;
            }
          } catch {
            // If we can't parse error response, use status-based messages
            if (response.status === 401) {
              errorMessage = 'Authentication failed - please verify your API key';
            } else if (response.status === 429) {
              errorMessage = 'Rate limit exceeded - please wait before trying again';
            } else if (response.status === 422) {
              errorMessage = 'Invalid request - please check your text input';
            } else if (response.status >= 500) {
              errorMessage = 'Server error - please try again in a moment';
            }
          }
          
          throw new Error(errorMessage);
        }

        return await response.blob();
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out - the text might be too long or there may be network issues');
        }
        throw fetchError;
      }
    }, 2); // Reduce retries for TTS to 2 attempts
  }

  async getCharacterCount(): Promise<number> {
    if (!this.apiKey) {
      return 0;
    }

    try {
      return await this.retryWithBackoff(async () => {
        const response = await fetch(`${this.baseUrl}/user`, {
          headers: {
            'xi-api-key': this.apiKey,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to get user info: ${response.statusText}`);
        }

        const data = await response.json();
        return data.subscription?.character_count || 0;
      });
    } catch (error) {
      console.error('Error fetching character count:', error);
      return 0;
    }
  }
}

export const elevenLabsService = new ElevenLabsService();