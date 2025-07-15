import { VoiceSettings } from '../types';

export interface VoiceOption {
  id: string;
  name: string;
  accent: 'USA' | 'UK';
  gender: 'Male' | 'Female';
  fileName: string;
  available: boolean;
}

export interface StoryManifest {
  storyId: string;
  title: string;
  gradeLevel: number;
  voices: VoiceOption[];
  createdAt: string;
  version: string;
}

// Voice mapping based on the task requirements
const VOICE_PROFILES: VoiceOption[] = [
  {
    id: 'usa-female-bella',
    name: 'Bella',
    accent: 'USA',
    gender: 'Female',
    fileName: 'usa-female-bella.mp3',
    available: false
  },
  {
    id: 'usa-male-josh',
    name: 'Josh',
    accent: 'USA',
    gender: 'Male',
    fileName: 'usa-male-josh.mp3',
    available: false
  },
  {
    id: 'uk-female-charlotte',
    name: 'Charlotte',
    accent: 'UK',
    gender: 'Female',
    fileName: 'uk-female-charlotte.mp3',
    available: false
  },
  {
    id: 'uk-male-daniel',
    name: 'Daniel',
    accent: 'UK',
    gender: 'Male',
    fileName: 'uk-male-daniel.mp3',
    available: false
  }
];

class AudioLibraryService {
  private readonly baseUrl = '/audio-library';
  private manifestCache = new Map<string, StoryManifest>();

  /**
   * Get the file path for a story's audio based on voice settings
   */
  getStoryPath(storyId: string, gradeLevel: number): string {
    return `${this.baseUrl}/grade-${gradeLevel}/${storyId}`;
  }

  /**
   * Get the best matching voice for given settings
   */
  getBestVoice(voiceSettings: VoiceSettings): VoiceOption {
    return VOICE_PROFILES.find(
      voice => voice.accent === voiceSettings.accent && voice.gender === voiceSettings.gender
    ) || VOICE_PROFILES[0]; // Fallback to first voice
  }

  /**
   * Check if a specific audio file exists for a story
   */
  async checkAudioAvailability(storyId: string, gradeLevel: number, voiceSettings: VoiceSettings): Promise<boolean> {
    const voice = this.getBestVoice(voiceSettings);
    const audioPath = `${this.getStoryPath(storyId, gradeLevel)}/${voice.fileName}`;
    
    try {
      const response = await fetch(audioPath, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.warn(`Audio file not available: ${audioPath}`);
      return false;
    }
  }

  /**
   * Get the audio URL for a story with specific voice settings
   */
  async getAudioUrl(storyId: string, gradeLevel: number, voiceSettings: VoiceSettings): Promise<string | null> {
    const voice = this.getBestVoice(voiceSettings);
    const audioPath = `${this.getStoryPath(storyId, gradeLevel)}/${voice.fileName}`;
    
    const isAvailable = await this.checkAudioAvailability(storyId, gradeLevel, voiceSettings);
    
    if (isAvailable) {
      return audioPath;
    }
    
    return null;
  }

  /**
   * Load story manifest file
   */
  async loadStoryManifest(storyId: string, gradeLevel: number): Promise<StoryManifest | null> {
    const cacheKey = `${storyId}-${gradeLevel}`;
    
    if (this.manifestCache.has(cacheKey)) {
      return this.manifestCache.get(cacheKey)!;
    }

    try {
      const manifestPath = `${this.getStoryPath(storyId, gradeLevel)}/manifest.json`;
      const response = await fetch(manifestPath);
      
      if (!response.ok) {
        return null;
      }
      
      const manifest: StoryManifest = await response.json();
      this.manifestCache.set(cacheKey, manifest);
      return manifest;
    } catch (error) {
      console.warn(`Manifest not found for story ${storyId}:`, error);
      return null;
    }
  }

  /**
   * Get all available voices for a story
   */
  async getAvailableVoices(storyId: string, gradeLevel: number): Promise<VoiceOption[]> {
    const manifest = await this.loadStoryManifest(storyId, gradeLevel);
    
    if (manifest) {
      return manifest.voices;
    }
    
    // Fallback: check each voice individually
    const availableVoices: VoiceOption[] = [];
    
    for (const voice of VOICE_PROFILES) {
      const voiceSettings: VoiceSettings = {
        accent: voice.accent,
        gender: voice.gender
      };
      
      const isAvailable = await this.checkAudioAvailability(storyId, gradeLevel, voiceSettings);
      
      if (isAvailable) {
        availableVoices.push({
          ...voice,
          available: true
        });
      }
    }
    
    return availableVoices;
  }

  /**
   * Generate a default manifest for a story
   */
  generateDefaultManifest(storyId: string, title: string, gradeLevel: number): StoryManifest {
    return {
      storyId,
      title,
      gradeLevel,
      voices: VOICE_PROFILES.map(voice => ({ ...voice, available: false })),
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Preload audio file for faster playback
   */
  async preloadAudio(storyId: string, gradeLevel: number, voiceSettings: VoiceSettings): Promise<HTMLAudioElement | null> {
    const audioUrl = await this.getAudioUrl(storyId, gradeLevel, voiceSettings);
    
    if (!audioUrl) {
      return null;
    }
    
    const audio = new Audio(audioUrl);
    
    return new Promise((resolve, reject) => {
      audio.addEventListener('canplaythrough', () => resolve(audio), { once: true });
      audio.addEventListener('error', () => reject(new Error('Failed to preload audio')), { once: true });
      
      // Set a timeout to avoid hanging indefinitely
      setTimeout(() => reject(new Error('Audio preload timeout')), 10000);
      
      audio.load();
    });
  }

  /**
   * Get voice info for UI display
   */
  getVoiceInfo(voiceSettings: VoiceSettings): { name: string; id: string; displayName: string } {
    const voice = this.getBestVoice(voiceSettings);
    return {
      name: voice.name,
      id: voice.id,
      displayName: `${voice.name} (${voice.accent} ${voice.gender})`
    };
  }

  /**
   * Clear manifest cache
   */
  clearCache(): void {
    this.manifestCache.clear();
  }
}

export const audioLibraryService = new AudioLibraryService();