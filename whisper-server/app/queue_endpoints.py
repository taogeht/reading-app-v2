"""
FastAPI endpoints for job queue management
Async processing endpoints with job status tracking
"""

import asyncio
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, File, UploadFile, HTTPException, BackgroundTasks, Form
from pydantic import BaseModel

try:
    from tasks import process_audio_async, process_batch_audio, get_job_status
    from celery_app import celery_app
except ImportError:
    from app.tasks import process_audio_async, process_batch_audio, get_job_status
    from app.celery_app import celery_app

router = APIRouter(prefix="/queue", tags=["Job Queue"])

class JobSubmissionResponse(BaseModel):
    job_id: str
    status: str
    message: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    ready: bool
    successful: Optional[bool] = None
    failed: Optional[bool] = None
    result: Optional[Dict[str, Any]] = None
    progress: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class BatchJobResponse(BaseModel):
    batch_id: str
    total_files: int
    job_ids: List[Dict[str, str]]
    status: str
    submitted_at: str

@router.post("/submit", response_model=JobSubmissionResponse)
async def submit_audio_job(
    audio_file: UploadFile = File(...),
    model: str = Form("base"),
    expected_text: Optional[str] = Form(None),
    expected_wpm: int = Form(100)
):
    """
    Submit audio file for async processing
    Returns immediately with job ID for status tracking
    """
    
    # Validate file type
    if not audio_file.content_type.startswith('audio/'):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    try:
        # Read audio data
        audio_data = await audio_file.read()
        
        # Prepare processing options
        options = {
            'model': model,
            'expected_text': expected_text,
            'expected_wpm': expected_wpm
        }
        
        # Submit job to queue
        job = process_audio_async.delay(audio_data, audio_file.filename, options)
        
        return JobSubmissionResponse(
            job_id=job.id,
            status="PENDING",
            message=f"Audio processing job submitted successfully for file: {audio_file.filename}"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit job: {str(e)}")

@router.post("/submit-batch", response_model=BatchJobResponse)
async def submit_batch_job(
    audio_files: List[UploadFile] = File(...),
    model: str = Form("base"),
    expected_wpm: int = Form(100)
):
    """
    Submit multiple audio files for batch processing
    """
    
    if len(audio_files) > 50:  # Limit batch size
        raise HTTPException(status_code=400, detail="Batch size limited to 50 files")
    
    try:
        # Prepare file data
        file_data = []
        for audio_file in audio_files:
            if not audio_file.content_type.startswith('audio/'):
                raise HTTPException(
                    status_code=400, 
                    detail=f"File {audio_file.filename} is not an audio file"
                )
            
            data = await audio_file.read()
            file_data.append({
                'data': data,
                'filename': audio_file.filename
            })
        
        # Prepare options
        options = {
            'model': model,
            'expected_wpm': expected_wpm
        }
        
        # Submit batch job
        batch_job = process_batch_audio.delay(file_data, options)
        
        # Get initial result
        result = batch_job.get(timeout=10)  # Wait up to 10 seconds for submission
        
        return BatchJobResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit batch job: {str(e)}")

@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status_endpoint(job_id: str):
    """
    Get current status of a job
    """
    try:
        # Get job status using Celery AsyncResult
        result = celery_app.AsyncResult(job_id)
        
        response = JobStatusResponse(
            job_id=job_id,
            status=result.status,
            ready=result.ready(),
            successful=result.successful() if result.ready() else None,
            failed=result.failed() if result.ready() else None
        )
        
        if result.ready():
            if result.successful():
                response.result = result.result
            else:
                response.error = str(result.result)
        else:
            # Job is still running, get progress if available
            if result.status == 'PROGRESS' and result.result:
                response.progress = result.result
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")

@router.get("/batch-status/{batch_id}")
async def get_batch_status(batch_id: str):
    """
    Get status of all jobs in a batch
    """
    try:
        # Get batch job result
        batch_result = celery_app.AsyncResult(batch_id)
        
        if not batch_result.ready():
            return {
                "batch_id": batch_id,
                "status": batch_result.status,
                "ready": False
            }
        
        if batch_result.failed():
            return {
                "batch_id": batch_id,
                "status": "FAILED",
                "error": str(batch_result.result)
            }
        
        # Get batch info
        batch_info = batch_result.result
        job_ids = batch_info.get('job_ids', [])
        
        # Check status of individual jobs
        job_statuses = []
        for job_info in job_ids:
            job_id = job_info['job_id']
            job_result = celery_app.AsyncResult(job_id)
            
            job_status = {
                'job_id': job_id,
                'filename': job_info['filename'],
                'status': job_result.status,
                'ready': job_result.ready()
            }
            
            if job_result.ready():
                if job_result.successful():
                    job_status['result'] = job_result.result
                else:
                    job_status['error'] = str(job_result.result)
            elif job_result.status == 'PROGRESS':
                job_status['progress'] = job_result.result
            
            job_statuses.append(job_status)
        
        # Calculate batch summary
        total_jobs = len(job_statuses)
        completed_jobs = sum(1 for job in job_statuses if job['ready'])
        failed_jobs = sum(1 for job in job_statuses if job.get('error'))
        
        return {
            "batch_id": batch_id,
            "status": "COMPLETED" if completed_jobs == total_jobs else "IN_PROGRESS",
            "total_jobs": total_jobs,
            "completed_jobs": completed_jobs,
            "failed_jobs": failed_jobs,
            "progress_percentage": round((completed_jobs / total_jobs) * 100, 1),
            "jobs": job_statuses,
            "batch_info": batch_info
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get batch status: {str(e)}")

@router.delete("/cancel/{job_id}")
async def cancel_job(job_id: str):
    """
    Cancel a pending or running job
    """
    try:
        celery_app.control.revoke(job_id, terminate=True)
        
        return {
            "job_id": job_id,
            "status": "CANCELLED",
            "message": "Job cancellation requested"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")

@router.get("/active-jobs")
async def get_active_jobs():
    """
    Get list of currently active jobs across all workers
    """
    try:
        # Get active jobs from all workers
        inspect = celery_app.control.inspect()
        active_jobs = inspect.active()
        
        if not active_jobs:
            return {"active_jobs": [], "total_active": 0}
        
        # Flatten job list
        all_active = []
        for worker, jobs in active_jobs.items():
            for job in jobs:
                job['worker'] = worker
                all_active.append(job)
        
        return {
            "active_jobs": all_active,
            "total_active": len(all_active),
            "workers": list(active_jobs.keys())
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get active jobs: {str(e)}")

@router.get("/queue-stats")
async def get_queue_stats():
    """
    Get queue statistics and worker information
    """
    try:
        inspect = celery_app.control.inspect()
        
        # Get queue lengths
        active_queues = inspect.active_queues()
        
        # Get worker stats
        stats = inspect.stats()
        
        # Get reserved tasks
        reserved = inspect.reserved()
        
        return {
            "queues": active_queues,
            "worker_stats": stats,
            "reserved_tasks": reserved,
            "timestamp": asyncio.get_event_loop().time()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get queue stats: {str(e)}")