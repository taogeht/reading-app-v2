"""
Whisper API Server for Reading Recording Practice
FastAPI server providing speech-to-text capabilities for student recordings
"""

import os
import tempfile
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import whisper
import torch
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import aiofiles

# Import queue endpoints
from queue_endpoints import router as queue_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/whisper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Whisper Speech-to-Text API",
    description="Speech analysis server for reading recording practice",
    version="1.0.0"
)

# Include queue management endpoints
app.include_router(queue_router)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
whisper_model = None
model_name = os.getenv("WHISPER_MODEL", "base")  # base, small, medium, large

class TranscriptionResponse(BaseModel):
    text: str
    language: str
    confidence: float
    segments: list
    duration: float
    words_per_minute: Optional[float] = None
    pause_count: Optional[int] = None
    fluency_score: Optional[float] = None

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: str
    gpu_available: bool

@app.on_event("startup")
async def startup_event():
    """Load Whisper model on startup"""
    global whisper_model
    try:
        logger.info(f"Loading Whisper model: {model_name}")
        
        # Check for GPU availability
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        
        # Load model
        whisper_model = whisper.load_model(model_name, device=device)
        logger.info("Whisper model loaded successfully")
        
        # Create necessary directories
        os.makedirs("/app/uploads", exist_ok=True)
        os.makedirs("/app/logs", exist_ok=True)
        
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
        raise

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy" if whisper_model is not None else "unhealthy",
        model_loaded=whisper_model is not None,
        model_name=model_name,
        gpu_available=torch.cuda.is_available()
    )

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    audio_file: UploadFile = File(...)
):
    """
    Transcribe audio file and return detailed analysis
    """
    if whisper_model is None:
        raise HTTPException(status_code=503, detail="Whisper model not loaded")
    
    # Validate file type
    if not audio_file.content_type.startswith('audio/'):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    temp_file_path = None
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file_path = temp_file.name
            
            # Save uploaded file
            async with aiofiles.open(temp_file_path, 'wb') as f:
                content = await audio_file.read()
                await f.write(content)
        
        logger.info(f"Processing audio file: {audio_file.filename}")
        
        # Transcribe with Whisper
        result = whisper_model.transcribe(
            temp_file_path,
            word_timestamps=True,
            verbose=False
        )
        
        # Extract segments with timestamps
        segments = []
        total_words = 0
        total_duration = 0
        pause_count = 0
        
        for segment in result.get("segments", []):
            segment_data = {
                "start": segment["start"],
                "end": segment["end"],
                "text": segment["text"].strip(),
                "confidence": segment.get("avg_logprob", 0)
            }
            segments.append(segment_data)
            
            # Count words and pauses
            words = len(segment["text"].split())
            total_words += words
            total_duration = max(total_duration, segment["end"])
            
            # Detect pauses (gaps > 0.5 seconds between segments)
            if segments and len(segments) > 1:
                prev_end = segments[-2]["end"]
                if segment["start"] - prev_end > 0.5:
                    pause_count += 1
        
        # Calculate reading metrics
        words_per_minute = (total_words / total_duration * 60) if total_duration > 0 else 0
        
        # Simple fluency score based on WPM and pause frequency
        expected_wpm = 100  # Adjust based on grade level
        wpm_score = min(words_per_minute / expected_wpm, 1.0) if expected_wpm > 0 else 0
        pause_penalty = max(0, 1 - (pause_count / total_words * 10)) if total_words > 0 else 0
        fluency_score = (wpm_score * 0.7 + pause_penalty * 0.3) * 100
        
        # Calculate overall confidence
        avg_confidence = sum(s["confidence"] for s in segments) / len(segments) if segments else 0
        
        response = TranscriptionResponse(
            text=result["text"].strip(),
            language=result.get("language", "unknown"),
            confidence=float(avg_confidence),
            segments=segments,
            duration=total_duration,
            words_per_minute=round(words_per_minute, 1),
            pause_count=pause_count,
            fluency_score=round(fluency_score, 1)
        )
        
        logger.info(f"Transcription completed: {len(result['text'])} chars, {total_words} words")
        
        # Schedule cleanup
        background_tasks.add_task(cleanup_temp_file, temp_file_path)
        
        return response
        
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        if temp_file_path:
            background_tasks.add_task(cleanup_temp_file, temp_file_path)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post("/analyze")
async def analyze_text(
    background_tasks: BackgroundTasks,
    audio_file: UploadFile = File(...),
    expected_text: Optional[str] = None
):
    """
    Analyze audio against expected text for accuracy scoring
    """
    transcription = await transcribe_audio(background_tasks, audio_file)
    
    if expected_text:
        # Calculate accuracy score by comparing with expected text
        accuracy = calculate_text_similarity(transcription.text, expected_text)
        return {
            **transcription.dict(),
            "expected_text": expected_text,
            "accuracy_score": accuracy
        }
    
    return transcription

def cleanup_temp_file(file_path: str):
    """Clean up temporary files"""
    try:
        if os.path.exists(file_path):
            os.unlink(file_path)
            logger.info(f"Cleaned up temp file: {file_path}")
    except Exception as e:
        logger.error(f"Failed to cleanup temp file {file_path}: {e}")

def calculate_text_similarity(transcribed: str, expected: str) -> float:
    """
    Calculate similarity between transcribed and expected text
    Returns accuracy score between 0 and 100
    """
    from difflib import SequenceMatcher
    
    # Normalize texts
    transcribed = transcribed.lower().strip()
    expected = expected.lower().strip()
    
    # Calculate similarity ratio
    matcher = SequenceMatcher(None, transcribed, expected)
    similarity = matcher.ratio()
    
    return round(similarity * 100, 1)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)