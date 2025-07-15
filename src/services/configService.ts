interface ServiceConfig {
  whisperServerUrl: string;
  preferredSpeechService: 'whisper' | 'google' | 'auto';
  whisperTimeout: number;
}

class ConfigService {
  private config: ServiceConfig;

  constructor() {
    this.config = {
      whisperServerUrl: this.getWhisperServerUrl(),
      preferredSpeechService: this.getPreferredSpeechService(),
      whisperTimeout: 300000, // 5 minutes
    };
  }

  private getWhisperServerUrl(): string {
    // Try environment variable first
    const envUrl = import.meta.env.VITE_WHISPER_SERVER_URL;
    if (envUrl) return envUrl;

    // Try to detect if we're in development vs production
    const isDevelopment = import.meta.env.DEV;
    
    if (isDevelopment) {
      // In development, try localhost first
      return 'http://localhost:8000';
    } else {
      // In production, we'll need to configure this
      // For now, return localhost as fallback
      return 'http://localhost:8000';
    }
  }

  private getPreferredSpeechService(): 'whisper' | 'google' | 'auto' {
    const preference = import.meta.env.VITE_PREFERRED_SPEECH_SERVICE;
    if (preference === 'whisper' || preference === 'google' || preference === 'auto') {
      return preference;
    }
    return 'auto'; // Default to auto-detection
  }

  getConfig(): ServiceConfig {
    return { ...this.config };
  }

  updateWhisperUrl(url: string): void {
    this.config.whisperServerUrl = url;
  }

  updatePreferredService(service: 'whisper' | 'google' | 'auto'): void {
    this.config.preferredSpeechService = service;
  }

  updateWhisperTimeout(timeoutMs: number): void {
    this.config.whisperTimeout = timeoutMs;
  }

  // Helper method to test if Whisper server is available
  async isWhisperServerAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.config.whisperServerUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('Whisper server health check failed:', error);
      return false;
    }
  }

  // Get runtime configuration for UI display
  async getRuntimeStatus(): Promise<{
    whisperAvailable: boolean;
    googleApiConfigured: boolean;
    recommendedService: 'whisper' | 'google';
  }> {
    const whisperAvailable = await this.isWhisperServerAvailable();
    const googleApiConfigured = !!import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;

    let recommendedService: 'whisper' | 'google' = 'google';
    
    if (this.config.preferredSpeechService === 'whisper' && whisperAvailable) {
      recommendedService = 'whisper';
    } else if (this.config.preferredSpeechService === 'google' && googleApiConfigured) {
      recommendedService = 'google';
    } else if (this.config.preferredSpeechService === 'auto') {
      // Auto-detect: prefer Whisper if available, otherwise Google
      recommendedService = whisperAvailable ? 'whisper' : 'google';
    }

    return {
      whisperAvailable,
      googleApiConfigured,
      recommendedService,
    };
  }
}

export const configService = new ConfigService();