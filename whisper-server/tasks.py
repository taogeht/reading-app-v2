"""
Celery tasks for background audio processing
Async job workers for speech analysis and transcription
"""

import os
import json
import tempfile
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from pathlib import Path

import whisper
import torch
import aiofiles
from celery import current_task
from celery.exceptions import Retry

from celery_app import celery_app

# Configure logging
logger = logging.getLogger(__name__)

# Global model cache
_model_cache = {}

def get_whisper_model(model_name: str = "base"):
    """Get or load Whisper model with caching"""
    if model_name not in _model_cache:
        try:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Loading Whisper model {model_name} on {device}")
            _model_cache[model_name] = whisper.load_model(model_name, device=device)
            logger.info(f"Model {model_name} loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            raise
    return _model_cache[model_name]

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_audio_async(self, audio_data: bytes, filename: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Process audio file asynchronously
    
    Args:
        audio_data: Raw audio file bytes
        filename: Original filename for reference
        options: Processing options (model, expected_text, etc.)
    
    Returns:
        Dict containing transcription results and analysis
    """
    job_id = self.request.id
    logger.info(f"Starting audio processing job {job_id} for file: {filename}")
    
    try:
        # Update task progress
        self.update_state(state='PROGRESS', meta={'status': 'Loading model', 'progress': 10})
        
        # Get options
        options = options or {}
        model_name = options.get('model', 'base')
        expected_text = options.get('expected_text')
        
        # Load model
        model = get_whisper_model(model_name)
        
        # Update progress
        self.update_state(state='PROGRESS', meta={'status': 'Saving audio file', 'progress': 20})
        
        # Save audio to temporary file
        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                temp_file_path = temp_file.name
                temp_file.write(audio_data)
            
            # Update progress
            self.update_state(state='PROGRESS', meta={'status': 'Transcribing audio', 'progress': 30})
            
            # Transcribe audio
            result = model.transcribe(
                temp_file_path,
                word_timestamps=True,
                verbose=False
            )
            
            # Update progress
            self.update_state(state='PROGRESS', meta={'status': 'Analyzing speech', 'progress': 70})
            
            # Process segments and calculate metrics
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
                
                # Count words and detect pauses
                words = len(segment["text"].split())
                total_words += words
                total_duration = max(total_duration, segment["end"])
                
                # Detect pauses (gaps > 0.5 seconds)
                if segments and len(segments) > 1:
                    prev_end = segments[-2]["end"]
                    if segment["start"] - prev_end > 0.5:
                        pause_count += 1
            
            # Calculate reading metrics
            words_per_minute = (total_words / total_duration * 60) if total_duration > 0 else 0
            
            # Calculate fluency score
            expected_wpm = options.get('expected_wpm', 100)
            wpm_score = min(words_per_minute / expected_wpm, 1.0) if expected_wpm > 0 else 0
            pause_penalty = max(0, 1 - (pause_count / total_words * 10)) if total_words > 0 else 0
            fluency_score = (wpm_score * 0.7 + pause_penalty * 0.3) * 100
            
            # Calculate accuracy if expected text provided
            accuracy_score = None
            if expected_text:
                accuracy_score = calculate_text_similarity(result["text"], expected_text)
            
            # Update progress
            self.update_state(state='PROGRESS', meta={'status': 'Finalizing results', 'progress': 90})
            
            # Prepare final result
            avg_confidence = sum(s["confidence"] for s in segments) / len(segments) if segments else 0
            
            final_result = {
                'job_id': job_id,
                'filename': filename,
                'text': result["text"].strip(),
                'language': result.get("language", "unknown"),
                'confidence': float(avg_confidence),
                'segments': segments,
                'duration': total_duration,
                'words_per_minute': round(words_per_minute, 1),
                'pause_count': pause_count,
                'fluency_score': round(fluency_score, 1),
                'accuracy_score': accuracy_score,
                'model_used': model_name,
                'processed_at': datetime.utcnow().isoformat(),
                'processing_time': None  # Will be calculated by caller
            }
            
            logger.info(f"Job {job_id} completed successfully: {len(result['text'])} chars, {total_words} words")
            return final_result
            
        finally:
            # Cleanup temp file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp file {temp_file_path}: {e}")
    
    except Exception as exc:
        logger.error(f"Job {job_id} failed: {exc}")
        
        # Retry logic
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying job {job_id} (attempt {self.request.retries + 1})")
            raise self.retry(countdown=60 * (2 ** self.request.retries), exc=exc)
        
        # Max retries exceeded
        self.update_state(
            state='FAILURE',
            meta={'error': str(exc), 'job_id': job_id, 'filename': filename}
        )
        raise exc

@celery_app.task(bind=True, max_retries=2)
def process_batch_audio(self, audio_files: List[Dict[str, Any]], options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Process multiple audio files in a batch
    
    Args:
        audio_files: List of dicts with 'data' (bytes) and 'filename' keys
        options: Shared processing options
    
    Returns:
        Dict with batch results and individual job IDs
    """
    batch_id = self.request.id
    logger.info(f"Starting batch processing job {batch_id} with {len(audio_files)} files")
    
    try:
        job_ids = []
        total_files = len(audio_files)
        
        # Submit individual jobs
        for i, file_info in enumerate(audio_files):
            progress = int((i / total_files) * 100)
            self.update_state(
                state='PROGRESS', 
                meta={
                    'status': f'Submitting job {i+1}/{total_files}',
                    'progress': progress,
                    'submitted': i,
                    'total': total_files
                }
            )
            
            # Submit individual processing job
            job = process_audio_async.delay(
                file_info['data'],
                file_info['filename'],
                options
            )
            job_ids.append({
                'job_id': job.id,
                'filename': file_info['filename'],
                'status': 'PENDING'
            })
        
        result = {
            'batch_id': batch_id,
            'total_files': total_files,
            'job_ids': job_ids,
            'submitted_at': datetime.utcnow().isoformat(),
            'status': 'SUBMITTED'
        }
        
        logger.info(f"Batch {batch_id} submitted successfully with {len(job_ids)} jobs")
        return result
        
    except Exception as exc:
        logger.error(f"Batch job {batch_id} failed: {exc}")
        if self.request.retries < self.max_retries:
            raise self.retry(countdown=120, exc=exc)
        raise exc

@celery_app.task
def cleanup_old_files():
    """Clean up old temporary files"""
    try:
        upload_dir = Path("/app/uploads")
        if upload_dir.exists():
            cutoff_time = datetime.now() - timedelta(hours=1)
            
            deleted_count = 0
            for file_path in upload_dir.iterdir():
                if file_path.is_file():
                    file_time = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if file_time < cutoff_time:
                        file_path.unlink()
                        deleted_count += 1
            
            logger.info(f"Cleaned up {deleted_count} old files from uploads directory")
        
    except Exception as e:
        logger.error(f"File cleanup failed: {e}")

@celery_app.task
def cleanup_old_results():
    """Clean up old job results from Redis"""
    try:
        # This would typically involve Redis operations to clean old results
        # For now, we rely on Redis TTL settings
        logger.info("Job result cleanup completed (handled by Redis TTL)")
        
    except Exception as e:
        logger.error(f"Result cleanup failed: {e}")

@celery_app.task(bind=True)
def get_job_status(self, job_id: str) -> Dict[str, Any]:
    """Get detailed status of a job"""
    try:
        result = celery_app.AsyncResult(job_id)
        
        status_info = {
            'job_id': job_id,
            'status': result.status,
            'ready': result.ready(),
            'successful': result.successful() if result.ready() else None,
            'failed': result.failed() if result.ready() else None,
        }
        
        if result.ready():
            if result.successful():
                status_info['result'] = result.result
            else:
                status_info['error'] = str(result.result)
        else:
            # Job is still running, get progress if available
            if result.status == 'PROGRESS':
                status_info['progress'] = result.result
        
        return status_info
        
    except Exception as e:
        logger.error(f"Failed to get job status for {job_id}: {e}")
        return {
            'job_id': job_id,
            'status': 'UNKNOWN',
            'error': str(e)
        }

def calculate_text_similarity(transcribed: str, expected: str) -> float:
    """Calculate similarity between transcribed and expected text"""
    from difflib import SequenceMatcher
    
    # Normalize texts
    transcribed = transcribed.lower().strip()
    expected = expected.lower().strip()
    
    # Calculate similarity ratio
    matcher = SequenceMatcher(None, transcribed, expected)
    similarity = matcher.ratio()
    
    return round(similarity * 100, 1)