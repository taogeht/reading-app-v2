#!/usr/bin/env node

/**
 * Audio Library Generator
 * 
 * This script generates static audio files for all stories using ElevenLabs API
 * and organizes them in the proper directory structure.
 * 
 * Usage: node scripts/generateAudioLibrary.js
 * 
 * Requirements:
 * - VITE_ELEVENLABS_API_KEY in .env file
 * - Stories data in public/stories.json
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Voice mapping
const VOICE_MAPPING = {
  'usa-female-bella': { accent: 'USA', gender: 'Female', elevenLabsId: 'EXAVITQu4vr4xnSDxMaL' },
  'usa-male-josh': { accent: 'USA', gender: 'Male', elevenLabsId: 'TxGEqnHWrfWFTfGW9XjX' },
  'uk-female-charlotte': { accent: 'UK', gender: 'Female', elevenLabsId: 'XB0fDUnXU5powFXDhCwa' },
  'uk-male-daniel': { accent: 'UK', gender: 'Male', elevenLabsId: 'onwK4e9ZLuTAKqWW03F9' }
};

async function loadStories() {
  const storiesPath = path.join(__dirname, '../public/stories.json');
  const storiesData = fs.readFileSync(storiesPath, 'utf8');
  return JSON.parse(storiesData);
}

async function generateAudioFile(text, voiceId, outputPath) {
  if (!process.env.VITE_ELEVENLABS_API_KEY) {
    throw new Error('VITE_ELEVENLABS_API_KEY not found in environment');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': process.env.VITE_ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
}

async function updateManifest(storyDir, voiceId) {
  const manifestPath = path.join(storyDir, 'manifest.json');
  
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Update the specific voice to available
    const voice = manifest.voices.find(v => v.id === voiceId);
    if (voice) {
      voice.available = true;
    }
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
}

async function generateAudioLibrary() {
  console.log('🎵 Starting Audio Library Generation...\n');
  
  try {
    const stories = await loadStories();
    const audioLibraryPath = path.join(__dirname, '../public/audio-library');
    
    for (const story of stories) {
      console.log(`📖 Processing: ${story.title} (Grade ${story.gradeLevel})`);
      
      const storyDir = path.join(audioLibraryPath, `grade-${story.gradeLevel}`, story.id);
      
      // Ensure directory exists
      fs.mkdirSync(storyDir, { recursive: true });
      
      // Generate audio for each voice
      for (const [voiceId, voiceConfig] of Object.entries(VOICE_MAPPING)) {
        console.log(`  🎤 Generating ${voiceId}...`);
        
        const audioPath = path.join(storyDir, `${voiceId}.mp3`);
        
        // Skip if file already exists
        if (fs.existsSync(audioPath)) {
          console.log(`  ✅ ${voiceId} already exists, skipping`);
          continue;
        }
        
        try {
          await generateAudioFile(story.text, voiceConfig.elevenLabsId, audioPath);
          await updateManifest(storyDir, voiceId);
          console.log(`  ✅ Generated ${voiceId}`);
          
          // Rate limiting - wait between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`  ❌ Failed to generate ${voiceId}:`, error.message);
        }
      }
      
      console.log(`✅ Completed: ${story.title}\n`);
    }
    
    console.log('🎉 Audio library generation complete!');
    
  } catch (error) {
    console.error('❌ Error generating audio library:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateAudioLibrary();
}

module.exports = { generateAudioLibrary };