# Diagnose Celery Import Issue

## Current Problem
- Files exist in container but Celery can't import `celery_app` module
- Error: "The module celery_app was not found"

## Step 1: Run These Diagnostic Commands

SSH to your unRAID server and run these commands to identify the exact issue:

### A. Check Container File Locations
```bash
cd /mnt/user/appdata/whisper-server

# Check what directory the worker is running from
docker-compose exec whisper-worker pwd

# Check what files exist in current directory
docker-compose exec whisper-worker ls -la

# Check what files exist in /app directory
docker-compose exec whisper-worker ls -la /app/

# Check if celery_app.py specifically exists and is readable
docker-compose exec whisper-worker ls -la celery_app.py
docker-compose exec whisper-worker ls -la /app/celery_app.py
```

### B. Check Python Import Paths
```bash
# See Python's module search paths
docker-compose exec whisper-worker python -c "import sys; print('\\n'.join(sys.path))"

# Test if Python can import our module
docker-compose exec whisper-worker python -c "import celery_app; print('✅ Import successful!')"

# Test from /app directory specifically
docker-compose exec whisper-worker sh -c "cd /app && python -c 'import celery_app; print(\"✅ Import from /app works!\")'"
```

### C. Check File Permissions and Contents
```bash
# Check file permissions
docker-compose exec whisper-worker ls -la celery_app.py

# Check file contents (first 5 lines)
docker-compose exec whisper-worker head -5 celery_app.py

# Check if file is empty or corrupted
docker-compose exec whisper-worker wc -l celery_app.py
```

---

## Step 2: Analyze the Results

### ✅ **If Python import works from /app directory:**
- Issue: Worker not running from correct directory
- **Fix**: Update docker-compose.yml working directory

### ✅ **If files exist but import fails:**
- Issue: PYTHONPATH not set correctly
- **Fix**: Update PYTHONPATH in docker-compose.yml

### ✅ **If files missing or wrong location:**
- Issue: Files copied to wrong place
- **Fix**: Copy files to correct location

### ✅ **If permission denied:**
- Issue: File permissions
- **Fix**: Fix file ownership/permissions

---

## Step 3: Common Diagnostic Results

### Scenario A: Files in Wrong Directory
```bash
# You'll see:
docker-compose exec whisper-worker pwd
# Output: /

docker-compose exec whisper-worker ls -la celery_app.py
# Output: No such file or directory

docker-compose exec whisper-worker ls -la /app/celery_app.py  
# Output: -rw-r--r-- 1 root root 2547 celery_app.py
```
**Fix**: Worker needs to run from `/app` directory

### Scenario B: Python Path Issue
```bash
# You'll see:
docker-compose exec whisper-worker python -c "import sys; print('\\n'.join(sys.path))"
# Output shows /app is NOT in Python path

docker-compose exec whisper-worker python -c "import celery_app"
# Output: ModuleNotFoundError: No module named 'celery_app'

docker-compose exec whisper-worker sh -c "cd /app && python -c 'import celery_app'"
# Output: ✅ Import from /app works!
```
**Fix**: Need to set PYTHONPATH=/app

### Scenario C: Permission Issue
```bash
# You'll see:
docker-compose exec whisper-worker ls -la celery_app.py
# Output: -rw------- 1 root root 2547 celery_app.py (no read permission for others)
```
**Fix**: Need to fix file permissions

---

## Step 4: Quick Test Commands

### Test Current Docker Compose Command
```bash
# See what command the worker is actually running
docker-compose exec whisper-worker ps aux

# Test the exact celery command manually
docker-compose exec whisper-worker sh -c "cd /app && PYTHONPATH=/app celery -A celery_app inspect ping"
```

### Test Different Import Methods
```bash
# Test different ways to import
docker-compose exec whisper-worker python -c "import sys; sys.path.insert(0, '/app'); import celery_app"
docker-compose exec whisper-worker sh -c "PYTHONPATH=/app python -c 'import celery_app'"
docker-compose exec whisper-worker sh -c "cd /app && python -m celery -A celery_app inspect ping"
```

---

## Expected Diagnostic Results

Run the commands above and you should see one of these patterns:

### Pattern 1: Directory Issue
- Worker running from `/` instead of `/app`
- Files exist in `/app/` but not in `/`

### Pattern 2: Python Path Issue  
- Worker running from `/app`
- Files exist but not in Python path
- Manual import from `/app` works

### Pattern 3: Permission Issue
- Files exist but not readable
- Permission denied errors

### Pattern 4: File Missing
- Files not copied correctly
- celery_app.py doesn't exist where expected

Once you run these diagnostics, we can create the exact fix needed!