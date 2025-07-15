#!/bin/bash
# Celery Worker Startup Script
# Use this to start workers manually or for debugging

echo "Starting Celery Worker for Whisper Audio Processing..."

# Set environment variables if not set
export REDIS_URL=${REDIS_URL:-redis://localhost:6379/0}
export WHISPER_MODEL=${WHISPER_MODEL:-base}
export PYTHONUNBUFFERED=1

# Start worker with configuration
celery -A app.celery_app worker \
  --loglevel=info \
  --concurrency=2 \
  --queues=audio_processing,batch_processing,default \
  --max-tasks-per-child=100 \
  --time-limit=3600 \
  --soft-time-limit=3300