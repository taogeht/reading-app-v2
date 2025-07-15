# Step-by-Step Fix: Celery Import Issue

## Current Status
- ✅ Files copied to unRAID (celery_app.py, tasks.py, main.py, queue_endpoints.py)
- ❌ Worker still crashing: "The module celery_app was not found"

## Quick 3-Step Fix Process

### Step 1: Diagnose the Issue (2 minutes)

SSH to your unRAID server and run:
```bash
cd /mnt/user/appdata/whisper-server

# Quick diagnostic test
docker-compose exec whisper-worker sh -c "cd /app && python -c 'import celery_app; print(\"✅ Import works!\")'"
```

**Expected Results:**
- ✅ **If it prints "✅ Import works!"** → Go to Step 2 (Fix #1)
- ❌ **If it shows import error** → Files in wrong location, check file copying
- ❌ **If container not running** → Container crashed, check logs first

### Step 2: Apply the Fix (1 minute)

#### Most Common Fix: Update Docker Compose Command

Edit your docker-compose.yml:
```bash
nano docker-compose.yml
```

Find the `whisper-worker` section and change this line:
```yaml
# FROM:
command: sh -c "cd /app && PYTHONPATH=/app celery -A celery_app worker --loglevel=info --concurrency=2 --queues=audio_processing,batch_processing,default"

# TO:
command: sh -c "cd /app && PYTHONPATH=/app:. python -m celery -A celery_app worker --loglevel=info --concurrency=2 --queues=audio_processing,batch_processing,default"
```

**Key Changes:**
- `PYTHONPATH=/app:.` (added current directory)
- `python -m celery` (use Python module syntax)

### Step 3: Restart and Verify (30 seconds)

```bash
# Restart worker with new command (fast, no rebuild)
docker-compose restart whisper-worker

# Check if it's working
docker-compose logs whisper-worker --tail 10

# Should see: "celery@worker ready."
```

---

## Detailed Step-by-Step Instructions

### Phase 1: Backup and Prepare

```bash
# SSH to unRAID
ssh root@192.168.1.26

# Navigate to whisper directory
cd /mnt/user/appdata/whisper-server

# Backup current docker-compose.yml (safety first)
cp docker-compose.yml docker-compose.yml.backup
```

### Phase 2: Quick Diagnostic

```bash
# Test if files exist and are importable
echo "Testing file import..."
if docker-compose exec whisper-worker sh -c "cd /app && python -c 'import celery_app'" 2>/dev/null; then
    echo "✅ Files are importable - need command fix"
else
    echo "❌ Import failed - check file locations"
    echo "Checking file locations..."
    docker-compose exec whisper-worker ls -la /app/celery_app.py
fi
```

### Phase 3: Apply Fix

#### Option A: Quick Command Line Edit
```bash
# Quick sed command to fix the docker-compose.yml
sed -i 's/PYTHONPATH=\/app celery -A celery_app/PYTHONPATH=\/app:. python -m celery -A celery_app/g' docker-compose.yml

# Verify the change
grep "python -m celery" docker-compose.yml
```

#### Option B: Manual Edit
```bash
# Edit file manually
nano docker-compose.yml

# Find this section:
#   whisper-worker:
#     command: sh -c "cd /app && PYTHONPATH=/app celery -A celery_app worker ..."

# Change to:
#     command: sh -c "cd /app && PYTHONPATH=/app:. python -m celery -A celery_app worker ..."
```

### Phase 4: Apply and Test

```bash
# Restart worker container
echo "Restarting worker with new command..."
docker-compose restart whisper-worker

# Wait a moment for startup
sleep 5

# Check container status
echo "Container status:"
docker-compose ps

# Check logs for success indicators
echo "Recent worker logs:"
docker-compose logs whisper-worker --tail 15

# Test worker ping
echo "Testing worker connection:"
if docker-compose exec -T whisper-worker celery -A celery_app inspect ping 2>/dev/null; then
    echo "✅ Worker is responding!"
else
    echo "⚠️ Worker not responding yet, check logs above"
fi
```

### Phase 5: Verify Complete Fix

```bash
# Test queue endpoints
echo "Testing queue endpoints..."
curl -s http://192.168.1.26:8000/queue/queue-stats | jq '.worker_stats != null'

# Check if pending job processes
echo "Checking pending job status..."
curl -s http://192.168.1.26:8000/queue/status/d95343de-cb77-469d-9144-3260b9832af2 | jq '.status'

# Test new job submission
echo "Testing new job submission..."
curl -X POST "http://192.168.1.26:8000/queue/submit" \
  -H "Content-Type: multipart/form-data" \
  -F "audio_file=@/tmp/test_audio.aiff" \
  -F "model=base" | jq '.job_id'
```

---

## Complete Docker Compose Worker Section

If you want to replace the entire worker section, here's the corrected version:

```yaml
whisper-worker:
  build: .
  container_name: whisper-celery-worker
  restart: unless-stopped
  
  # FIXED COMMAND with proper Python path
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
  
  deploy:
    resources:
      limits:
        cpus: '3.0'
        memory: 6G
      reservations:
        cpus: '2.0'
        memory: 4G
  
  healthcheck:
    test: ["CMD", "celery", "-A", "celery_app", "inspect", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 60s
  
  networks:
    - whisper-network
  
  depends_on:
    - redis
```

---

## Success Indicators

### ✅ Fixed Successfully:
```bash
# Container status shows "Up"
whisper-celery-worker    Up

# Logs show connection success
whisper-celery-worker | Connected to redis://redis:6379/0
whisper-celery-worker | mingle: searching for neighbors
whisper-celery-worker | mingle: all alone
whisper-celery-worker | celery@worker ready.

# Worker ping succeeds
-> celery@whisper-worker: OK

# Queue stats return data
{"queues":[...],"worker_stats":{...},"reserved_tasks":{...}}
```

### ❌ Still Having Issues:
```bash
# Check exact error
docker-compose logs whisper-worker --tail 20

# Test manual import
docker-compose exec whisper-worker python -c "import sys; print(sys.path); import celery_app"

# Try alternative fix
# See DOCKER_COMPOSE_FIXES.md for other options
```

---

## Timeline

- **Diagnosis**: 2 minutes
- **Edit docker-compose.yml**: 1 minute  
- **Restart container**: 30 seconds
- **Verification**: 1 minute
- **Total**: ~5 minutes

Once complete, your pending job should process automatically and new jobs will work immediately!