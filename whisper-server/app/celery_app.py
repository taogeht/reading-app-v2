"""
Celery configuration for async job processing
Background job queue system for audio processing workloads
"""

import os
from celery import Celery
from kombu import Queue

# Redis configuration
REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')

# Create Celery app
celery_app = Celery(
    'whisper_jobs',
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['app.tasks']
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Result settings
    result_expires=3600,  # Results expire after 1 hour
    result_backend_transport_options={
        'retry_on_timeout': True,
        'visibility_timeout': 3600,
    },
    
    # Worker settings
    worker_prefetch_multiplier=1,  # Process one task at a time per worker
    worker_max_tasks_per_child=100,  # Restart worker after 100 tasks
    worker_disable_rate_limits=True,
    
    # Task routing
    task_routes={
        'app.tasks.process_audio_async': {'queue': 'audio_processing'},
        'app.tasks.process_batch_audio': {'queue': 'batch_processing'},
        'app.tasks.cleanup_old_files': {'queue': 'maintenance'},
    },
    
    # Queue configuration
    task_default_queue='default',
    task_queues=(
        Queue('default', routing_key='default'),
        Queue('audio_processing', routing_key='audio_processing'),
        Queue('batch_processing', routing_key='batch_processing'),
        Queue('maintenance', routing_key='maintenance'),
    ),
    
    # Retry settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=60,  # 60 seconds
    task_max_retries=3,
    
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
    
    # Beat scheduler (for periodic tasks)
    beat_schedule={
        'cleanup-old-files': {
            'task': 'app.tasks.cleanup_old_files',
            'schedule': 3600.0,  # Run every hour
        },
        'cleanup-old-results': {
            'task': 'app.tasks.cleanup_old_results',
            'schedule': 7200.0,  # Run every 2 hours
        },
    },
)

# Tasks will be imported automatically when needed