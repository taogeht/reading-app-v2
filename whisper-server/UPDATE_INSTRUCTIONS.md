# Quick Update Instructions for unRAID

## Files to Copy to Your unRAID Server

Copy these new/updated files to your unRAID server:

### 1. New Queue System Files
```bash
# Copy these new files to /mnt/user/appdata/whisper-server/app/
app/celery_app.py
app/tasks.py
app/queue_endpoints.py
```

### 2. Updated Files
```bash
# Update these existing files:
app/main.py
requirements.txt
docker-compose.yml
README.md
```

### 3. New Scripts
```bash
# Copy utility scripts:
start-worker.sh
monitor-queue.sh
```

## Quick Update Commands

SSH into your unRAID server and run:

```bash
# Stop current containers
cd /mnt/user/appdata/whisper-server
docker-compose down

# Copy the new files (you'll need to transfer them first)
# Then rebuild and start with new queue system:
docker-compose build --no-cache
docker-compose up -d

# Check all services are running
docker-compose ps

# Should show:
# whisper-speech-server   Up
# whisper-celery-worker   Up  
# whisper-celery-beat     Up
# whisper-redis          Up
```

## Test Commands

Once updated, test the queue system:

```bash
# Test health endpoint
curl http://192.168.1.26:8000/health

# Test new queue endpoints
curl http://192.168.1.26:8000/queue/queue-stats
curl http://192.168.1.26:8000/queue/active-jobs

# View API docs with queue endpoints
# Visit: http://192.168.1.26:8000/docs
```

## Monitor the System

```bash
# Check container logs
docker-compose logs whisper-server
docker-compose logs whisper-worker

# Monitor queue activity
docker-compose logs -f whisper-worker
```