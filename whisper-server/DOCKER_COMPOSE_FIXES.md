# Docker Compose Fixes for Celery Import Issues

## Quick Reference: Common Fix Patterns

Based on diagnostic results, here are the most common fixes for the `celery_app module not found` error.

---

## Fix #1: Working Directory + Python Path (Most Common)

### Problem Symptoms:
- Worker running from `/` instead of `/app`
- Files exist in `/app/` but Python can't find them
- Manual import from `/app` works

### Solution: Update Worker Command
Edit your `docker-compose.yml` and change the worker command from:
```yaml
command: sh -c "cd /app && PYTHONPATH=/app celery -A celery_app worker ..."
```

To:
```yaml
command: sh -c "cd /app && PYTHONPATH=/app:. python -m celery -A celery_app worker --loglevel=info --concurrency=2 --queues=audio_processing,batch_processing,default"
```

**Key Changes:**
- `PYTHONPATH=/app:.` (adds current directory)
- `python -m celery` (uses Python module syntax)
- Ensures working from `/app` directory

---

## Fix #2: Environment Variables Approach

### Solution: Add Python Path to Environment
```yaml
services:
  whisper-worker:
    # ... existing config ...
    environment:
      - WHISPER_MODEL=base
      - PYTHONUNBUFFERED=1
      - TZ=America/New_York
      - REDIS_URL=redis://redis:6379/0
      - PYTHONPATH=/app:/app/app:/app/  # Add this line
    
    command: sh -c "cd /app && python -m celery -A celery_app worker --loglevel=info --concurrency=2 --queues=audio_processing,batch_processing,default"
```

---

## Fix #3: Absolute Module Path

### Solution: Use Full Path to Module
```yaml
command: sh -c "cd /app && PYTHONPATH=/app celery worker -A /app.celery_app --loglevel=info --concurrency=2 --queues=audio_processing,batch_processing,default"
```

Or:
```yaml
command: sh -c "cd /app && PYTHONPATH=/app python -c 'import sys; sys.path.insert(0, \"/app\"); from celery_app import celery_app; celery_app.worker_main()'"
```

---

## Fix #4: Hybrid App Structure Support

### Solution: Support Both Old and New Structure
```yaml
environment:
  - PYTHONPATH=/app:/app/app
  
command: sh -c "cd /app && python -c 'import sys; sys.path.extend([\"/app\", \"/app/app\"]); from celery import Celery; exec(open(\"celery_app.py\").read()); celery_app.worker_main([\"worker\", \"--loglevel=info\", \"--concurrency=2\"])'"
```

---

## Fix #5: Simple Working Directory Fix

### Solution: Ensure Correct Working Directory
```yaml
working_dir: /app
command: python -m celery -A celery_app worker --loglevel=info --concurrency=2 --queues=audio_processing,batch_processing,default
environment:
  - PYTHONPATH=/app
```

---

## Complete Docker Compose Worker Section Examples

### Option A: Recommended Fix (Works for Most Cases)
```yaml
whisper-worker:
  build: .
  container_name: whisper-celery-worker
  restart: unless-stopped
  
  # Updated command with proper paths
  command: sh -c "cd /app && PYTHONPATH=/app:. python -m celery -A celery_app worker --loglevel=info --concurrency=2 --queues=audio_processing,batch_processing,default"
  
  environment:
    - WHISPER_MODEL=base
    - PYTHONUNBUFFERED=1
    - TZ=America/New_York
    - REDIS_URL=redis://redis:6379/0
    - PYTHONPATH=/app
  
  volumes:
    - whisper_models:/root/.cache/whisper
    - ./logs:/app/logs
    - /tmp/whisper-uploads:/app/uploads
  
  networks:
    - whisper-network
  
  depends_on:
    - redis
```

### Option B: Alternative with Working Directory
```yaml
whisper-worker:
  build: .
  container_name: whisper-celery-worker
  restart: unless-stopped
  working_dir: /app
  
  # Simpler command since working_dir is set
  command: python -m celery -A celery_app worker --loglevel=info --concurrency=2 --queues=audio_processing,batch_processing,default
  
  environment:
    - WHISPER_MODEL=base
    - PYTHONUNBUFFERED=1
    - TZ=America/New_York
    - REDIS_URL=redis://redis:6379/0
    - PYTHONPATH=/app
  
  # ... rest of config same ...
```

---

## How to Apply the Fix

### Step 1: Edit docker-compose.yml
```bash
# On your unRAID server
cd /mnt/user/appdata/whisper-server
nano docker-compose.yml

# Find the whisper-worker section and update the command line
```

### Step 2: Apply Changes
```bash
# Restart with new configuration (fast, no rebuild)
docker-compose restart whisper-worker

# Or restart all services
docker-compose restart
```

### Step 3: Verify Fix
```bash
# Check logs for success
docker-compose logs whisper-worker --tail 20

# Should see:
# "Connected to redis://redis:6379/0"
# "celery@worker ready."

# Test worker ping
docker-compose exec whisper-worker celery -A celery_app inspect ping
```

---

## Quick Test: Which Fix Do You Need?

Run this diagnostic first:
```bash
# Test import from /app directory
docker-compose exec whisper-worker sh -c "cd /app && python -c 'import celery_app; print(\"✅ Import works from /app!\")'"

# If this works, use Fix #1 (working directory + python path)
# If this fails, check file locations and permissions first
```

---

## Troubleshooting After Applying Fix

### If Still Getting Import Errors:
```bash
# Check the actual command being run
docker-compose exec whisper-worker ps aux | grep celery

# Test the exact command manually
docker-compose exec whisper-worker sh -c "cd /app && PYTHONPATH=/app:. python -m celery -A celery_app inspect ping"
```

### If Worker Starts but Crashes:
```bash
# Check for other import errors in tasks.py
docker-compose exec whisper-worker python -c "import tasks"

# Check Celery app configuration
docker-compose exec whisper-worker python -c "from celery_app import celery_app; print('Celery app loaded!')"
```

Most likely you'll need **Fix #1** - the working directory + Python path solution.