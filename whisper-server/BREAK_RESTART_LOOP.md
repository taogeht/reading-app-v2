# Break Container Restart Loop - Quick Fix Guide

## Problem
Container stuck in endless restart loop:
- Container starts → import fails → crashes → Docker restarts → repeat
- Can't test anything because container never stays running
- `docker-compose exec` fails: "Container is restarting"

## Solution: 3-Phase Fix

### Phase 1: Stop the Restart Loop (1 minute)

#### Step 1: Edit Docker Compose
```bash
cd /mnt/user/appdata/whisper-server
nano docker-compose.yml
```

#### Step 2: Find Worker Section and Replace Command
Find this section in docker-compose.yml:
```yaml
whisper-worker:
  # ... other config ...
  command: sh -c "cd /app && PYTHONPATH=/app:. python -m watchmedo auto-restart --directory=/app --pattern='*.py' --recursive -- celery -A celery_app worker --loglevel=info --concurrency=1 --queues=audio_processing,batch_processing,default"
```

**Replace the command with:**
```yaml
whisper-worker:
  # ... other config ...
  command: sleep infinity
```

#### Step 3: Save and Restart
```bash
# Save the file (Ctrl+X, Y, Enter in nano)

# Restart the worker
docker-compose restart whisper-worker

# Verify container stays running
docker-compose ps
```

**Expected Result:**
```
whisper-celery-worker    Up      # Should show "Up", not "Restarting"
```

---

### Phase 2: Test Import Issue (2 minutes)

Now that the container stays running, we can test:

#### Test 1: Basic Import
```bash
docker-compose exec whisper-worker sh -c "cd /app && python -c 'import celery_app; print(\"✅ Import works!\")'"
```

#### Test 2: Check File Locations
```bash
# Check if files exist
docker-compose exec whisper-worker ls -la /app/celery_app.py
docker-compose exec whisper-worker ls -la /app/tasks.py

# Check Python path
docker-compose exec whisper-worker python -c "import sys; print('\\n'.join(sys.path))"
```

#### Test 3: Test with PYTHONPATH
```bash
# Test with explicit Python path
docker-compose exec whisper-worker sh -c "PYTHONPATH=/app:. python -c 'import celery_app'"

# Test from /app directory
docker-compose exec whisper-worker sh -c "cd /app && PYTHONPATH=/app:. python -c 'import celery_app'"
```

#### Test 4: Test Celery Command
```bash
# Test basic celery ping
docker-compose exec whisper-worker sh -c "cd /app && PYTHONPATH=/app:. celery -A celery_app inspect ping"
```

---

### Phase 3: Apply the Correct Fix (1 minute)

Based on test results, edit docker-compose.yml again:

#### If Basic Import Works:
```yaml
whisper-worker:
  # ... other config ...
  command: sh -c "cd /app && PYTHONPATH=/app:. celery -A celery_app worker --loglevel=info --concurrency=1 --queues=audio_processing,batch_processing,default"
```

#### If You Want Watchmedo Auto-Restart:
```yaml
whisper-worker:
  # ... other config ...
  command: sh -c "cd /app && export PYTHONPATH=/app:. && python -m watchmedo auto-restart --directory=/app --pattern='*.py' --recursive -- env PYTHONPATH=/app:. celery -A celery_app worker --loglevel=info --concurrency=1 --queues=audio_processing,batch_processing,default"
```

#### Final Restart:
```bash
# Apply the working command
docker-compose restart whisper-worker

# Check logs for success
docker-compose logs whisper-worker --tail 20

# Should see: "celery@worker ready."
```

---

## Complete Commands Sequence

Here's the complete sequence to run on your unRAID server:

```bash
# Phase 1: Stop restart loop
cd /mnt/user/appdata/whisper-server
cp docker-compose.yml docker-compose.yml.backup  # Safety backup

# Edit docker-compose.yml and change worker command to: sleep infinity
nano docker-compose.yml

# Restart worker
docker-compose restart whisper-worker

# Verify it stays up
docker-compose ps

# Phase 2: Test imports
docker-compose exec whisper-worker sh -c "cd /app && PYTHONPATH=/app:. python -c 'import celery_app; print(\"Import test!\")'"

# Phase 3: Apply fix (based on test results)
# Edit docker-compose.yml again with working command
nano docker-compose.yml

# Final restart
docker-compose restart whisper-worker

# Verify success
docker-compose logs whisper-worker --tail 10
```

---

## Expected Success Indicators

### ✅ After Phase 1 (Breaking Loop):
```bash
docker-compose ps
# whisper-celery-worker    Up      # Shows "Up" not "Restarting"
```

### ✅ After Phase 2 (Import Test):
```bash
docker-compose exec whisper-worker sh -c "cd /app && python -c 'import celery_app'"
# Should complete without error
```

### ✅ After Phase 3 (Final Fix):
```bash
docker-compose logs whisper-worker --tail 5
# whisper-celery-worker | Connected to redis://redis:6379/0
# whisper-celery-worker | celery@worker ready.
```

---

## If Tests Fail in Phase 2

### If Import Fails:
```bash
# Check file locations
docker-compose exec whisper-worker find /app -name "*.py" -type f

# Check Python can find the file
docker-compose exec whisper-worker python -c "import os; print(os.getcwd()); print(os.listdir('.'))"
```

### If Files Missing:
```bash
# Copy files again
docker cp celery_app.py whisper-celery-worker:/app/
docker cp tasks.py whisper-celery-worker:/app/
```

### If Permission Issues:
```bash
# Check permissions
docker-compose exec whisper-worker ls -la /app/celery_app.py

# Fix if needed
docker-compose exec whisper-worker chmod 644 /app/celery_app.py
```

---

## Timeline
- **Phase 1**: 1 minute (stop restart loop)
- **Phase 2**: 2 minutes (test and diagnose)  
- **Phase 3**: 1 minute (apply fix)
- **Total**: ~4 minutes to completely fix

The key is breaking the restart loop first - then we can actually debug what's wrong!