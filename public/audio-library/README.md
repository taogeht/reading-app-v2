# Audio Library System

This directory contains pre-recorded audio files for stories, organized by grade level and story ID.

## Directory Structure

```
audio-library/
├── grade-{level}/
│   ├── {story-id}/
│   │   ├── manifest.json
│   │   ├── usa-female-bella.mp3
│   │   ├── usa-male-josh.mp3
│   │   ├── uk-female-charlotte.mp3
│   │   └── uk-male-daniel.mp3
│   └── ...
└── README.md
```

## Voice Options

The system supports these voice profiles:

- **usa-female-bella.mp3** - Bella (USA Female)
- **usa-male-josh.mp3** - Josh (USA Male)  
- **uk-female-charlotte.mp3** - Charlotte (UK Female)
- **uk-male-daniel.mp3** - Daniel (UK Male)

## Adding Audio Files

1. **Create story directory**: `/grade-{level}/{story-id}/`
2. **Add audio files**: Place MP3 files with exact naming convention
3. **Update manifest.json**: Set `available: true` for each voice
4. **Test**: Verify files load correctly in the application

## Manifest.json Format

```json
{
  "storyId": "story-001",
  "title": "Story Title",
  "gradeLevel": 2,
  "voices": [
    {
      "id": "usa-female-bella",
      "name": "Bella",
      "accent": "USA",
      "gender": "Female", 
      "fileName": "usa-female-bella.mp3",
      "available": true
    }
  ],
  "createdAt": "2024-01-15T10:00:00.000Z",
  "version": "1.0.0"
}
```

## Fallback Behavior

- If static audio files are missing, the system automatically falls back to ElevenLabs API
- Users see different indicators for static vs. generated audio
- Static files load much faster and are marked as "Free"

## Audio Requirements

- **Format**: MP3
- **Quality**: 128kbps or higher recommended
- **Length**: Should match story reading time
- **Content**: Clear pronunciation suitable for elementary students