# Quick Fix Manual (No 20-Minute Rebuild!)

## Problem
**Error**: `The module celery_app was not found.`
**Solution**: Copy files directly to containers + quick restart (30 seconds total)

## ⚡ Super Fast Option: Use the Script

### Step 1: Copy Files to unRAID
```bash
# From your Mac:
cd /Users/bryce/Desktop/recording/reading-recording-practice/whisper-server
scp celery_app.py tasks.py main.py queue_endpoints.py quick-fix.sh root@192.168.1.26:/mnt/user/appdata/whisper-server/
```

### Step 2: Run the Quick Fix Script
```bash
# SSH to unRAID and run:
cd /mnt/user/appdata/whisper-server
chmod +x quick-fix.sh
./quick-fix.sh
```

**Done!** The script handles everything automatically in ~30 seconds.

---

## 🔧 Manual Option: Step-by-Step Commands

If you prefer to run commands manually:

### Step 1: Copy Files to unRAID (if not done)
```bash
# Copy the 4 required files to unRAID
scp celery_app.py tasks.py main.py queue_endpoints.py root@192.168.1.26:/mnt/user/appdata/whisper-server/
```

### Step 2: Copy Files to Running Containers
```bash
# SSH to unRAID, then:
cd /mnt/user/appdata/whisper-server

# Copy files directly into containers (no rebuild!)
docker cp celery_app.py whisper-celery-worker:/app/
docker cp tasks.py whisper-celery-worker:/app/
docker cp main.py whisper-speech-server:/app/
docker cp queue_endpoints.py whisper-speech-server:/app/
```

### Step 3: Quick Container Restart (30 seconds)
```bash
# Restart just the affected containers (fast!)
docker-compose restart whisper-worker whisper-server

# OR restart everything (still fast)
docker-compose restart
```

### Step 4: Verify Files Exist
```bash
# Check if files are in the containers
docker-compose exec whisper-worker ls -la /app/celery_app.py
docker-compose exec whisper-worker ls -la /app/tasks.py
```

---

## 🧪 Verification Commands

### 1. Check Container Status
```bash
# Should show "Up" instead of "Restarting"
docker-compose ps
```

### 2. Check Worker Logs
```bash
# Should show "celery@worker ready" instead of errors
docker-compose logs whisper-worker --tail 20
```

### 3. Test Worker Connection
```bash
# Should respond "OK" instead of error
docker-compose exec whisper-worker celery -A celery_app inspect ping
```

### 4. Test Queue Endpoints
```bash
# Should return worker info (not null)
curl http://192.168.1.26:8000/queue/queue-stats | jq

# Should show workers
curl http://192.168.1.26:8000/queue/active-jobs | jq
```

### 5. Check Pending Job
```bash
# That pending job should now process!
curl http://192.168.1.26:8000/queue/status/d95343de-cb77-469d-9144-3260b9832af2 | jq
```

---

## ✅ Expected Success Output

### Healthy Container Status:
```
whisper-speech-server    Up      0.0.0.0:8000->8000/tcp
whisper-celery-worker    Up      
whisper-redis           Up      0.0.0.0:6379->6379/tcp
```

### Healthy Worker Logs:
```
whisper-celery-worker | Connected to redis://redis:6379/0
whisper-celery-worker | mingle: searching for neighbors
whisper-celery-worker | mingle: all alone
whisper-celery-worker | celery@worker ready.
```

### Worker Ping Success:
```
-> celery@whisper-worker: OK
    pong from celery@whisper-worker
```

### Queue Stats Working:
```json
{
  "queues": [...],
  "worker_stats": {...},
  "reserved_tasks": {...}
}
```

---

## 🚨 Troubleshooting

### If Still Getting "Module Not Found":
```bash
# Check if files really exist in container
docker-compose exec whisper-worker ls -la /app/

# Check file contents
docker-compose exec whisper-worker head -5 /app/celery_app.py

# Test Python import manually
docker-compose exec whisper-worker python -c "import celery_app; print('✅ Import works!')"
```

### If Import Works but Worker Still Crashes:
```bash
# Check for syntax errors
docker-compose exec whisper-worker python -m py_compile celery_app.py

# Check detailed logs
docker-compose logs whisper-worker --tail 50
```

### Alternative: Fix Docker Compose Command
If copying doesn't work, temporarily edit `docker-compose.yml`:
```yaml
# Change this line:
command: sh -c "cd /app && PYTHONPATH=/app celery -A celery_app worker ..."

# To this (looks in both places):
command: sh -c "cd /app && PYTHONPATH=/app:/app/app celery -A app.celery_app worker ..."
```

---

## ⏱️ Time Comparison

| Method | Time Required |
|--------|---------------|
| **Quick Fix** | 30 seconds |
| **Full Rebuild** | 20 minutes |
| **Savings** | 19.5 minutes! |

The pending job `d95343de-cb77-469d-9144-3260b9832af2` should start processing automatically once the worker comes online!