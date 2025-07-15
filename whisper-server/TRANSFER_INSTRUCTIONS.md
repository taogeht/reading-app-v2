# Quick Fix: Transfer Instructions for unRAID

## Problem Solved
**Error**: `The module celery_app was not found.`
**Solution**: Copy 4 root-level files to unRAID server and rebuild containers.

## Files to Transfer

You need to copy these 4 files from your local `whisper-server/` directory to your unRAID server:

### Required Files:
1. **`celery_app.py`** - Celery configuration (fixes the main error)
2. **`tasks.py`** - Background job tasks
3. **`main.py`** - FastAPI application with queue endpoints
4. **`queue_endpoints.py`** - Async job API endpoints

## Transfer Methods

### Option A: SCP (Recommended)
```bash
# From your Mac, copy all files at once:
cd /Users/bryce/Desktop/recording/reading-recording-practice/whisper-server

scp celery_app.py tasks.py main.py queue_endpoints.py root@192.168.1.26:/mnt/user/appdata/whisper-server/
```

### Option B: Individual Files
```bash
# Copy one by one if needed:
scp celery_app.py root@192.168.1.26:/mnt/user/appdata/whisper-server/
scp tasks.py root@192.168.1.26:/mnt/user/appdata/whisper-server/
scp main.py root@192.168.1.26:/mnt/user/appdata/whisper-server/
scp queue_endpoints.py root@192.168.1.26:/mnt/user/appdata/whisper-server/
```

### Option C: Manual Copy
Use your preferred file manager (WinSCP, FileZilla, etc.) to copy the 4 files to:
`/mnt/user/appdata/whisper-server/`

## Rebuild Commands (Run on unRAID)

After copying files, SSH to unRAID and run:

```bash
# Navigate to whisper directory
cd /mnt/user/appdata/whisper-server

# Stop crashing containers
docker-compose down

# Rebuild with new files
docker-compose build --no-cache

# Start containers
docker-compose up -d
```

## Verification Commands

### 1. Check Container Status
```bash
# Should show all containers as "Up" (not "Restarting")
docker-compose ps
```

### 2. Check Worker Logs
```bash
# Should show "celery@worker ready" instead of crashes
docker-compose logs whisper-worker --tail 20
```

### 3. Test Worker Connection
```bash
# Should respond with "OK" instead of error
docker-compose exec whisper-worker celery -A celery_app inspect ping
```

### 4. Test Queue Endpoints
```bash
# Should return worker info (not null)
curl http://192.168.1.26:8000/queue/queue-stats | jq

# Check if that pending job processes
curl http://192.168.1.26:8000/queue/status/d95343de-cb77-469d-9144-3260b9832af2
```

## Expected Success Output

### ✅ Healthy Container Status:
```
whisper-speech-server    Up      0.0.0.0:8000->8000/tcp
whisper-celery-worker    Up      
whisper-redis           Up      0.0.0.0:6379->6379/tcp
```

### ✅ Healthy Worker Logs:
```
whisper-celery-worker | Connected to redis://redis:6379/0
whisper-celery-worker | mingle: searching for neighbors
whisper-celery-worker | mingle: all alone
whisper-celery-worker | celery@worker ready.
```

### ✅ Working Queue Stats:
```json
{
  "queues": [...],
  "worker_stats": {...},
  "reserved_tasks": {...}
}
```

## If Still Having Issues

### Check File Locations:
```bash
# Verify files exist in container
docker-compose exec whisper-server ls -la /app/

# Should show:
# celery_app.py
# tasks.py  
# main.py
# queue_endpoints.py
```

### Check Import Test:
```bash
# Test Python imports
docker-compose exec whisper-worker python -c "import celery_app, tasks; print('✅ Imports work!')"
```

## Total Time Expected
- **File transfer**: 1-2 minutes
- **Container rebuild**: 3-5 minutes  
- **Verification**: 1 minute
- **Total**: ~5-8 minutes

Once complete, your Celery workers will be processing jobs and that pending job should complete automatically!