#!/bin/bash
# Quick Fix Script: Stop Container Restart Loop
# This gets your Celery worker stable so we can debug the import issue

set -e  # Exit on any error

echo "🔧 Quick Fix: Breaking Container Restart Loop"
echo "=============================================="

# Step 1: Backup current docker-compose.yml
echo "📋 Creating backup..."
cp docker-compose.yml docker-compose.yml.backup
echo "✅ Backup saved as docker-compose.yml.backup"

# Step 2: Replace worker command to stop crashes
echo "🛠️  Updating docker-compose.yml..."
sed -i.tmp 's/command: sh -c "cd \/app && PYTHONPATH=\/app.*"/command: sleep infinity/' docker-compose.yml

# Check if the replacement worked
if grep -q "sleep infinity" docker-compose.yml; then
    echo "✅ Docker compose updated successfully"
else
    echo "❌ Failed to update docker-compose.yml"
    echo "Manual edit required - see instructions below"
    exit 1
fi

# Step 3: Restart worker
echo "🔄 Restarting worker container..."
docker-compose restart whisper-worker

# Step 4: Wait for container to stabilize
echo "⏳ Waiting for container to stabilize..."
sleep 5

# Step 5: Check container status
echo "📊 Checking container status..."
if docker-compose ps | grep -q "whisper-celery-worker.*Up"; then
    echo "✅ SUCCESS: Container is now stable!"
    echo ""
    echo "🧪 Ready for testing! Run these commands:"
    echo ""
    echo "# Test basic import:"
    echo "docker-compose exec whisper-worker sh -c \"cd /app && python -c 'import celery_app; print(\\\"✅ Import works!\\\")'\""
    echo ""
    echo "# Check file locations:"
    echo "docker-compose exec whisper-worker ls -la /app/celery_app.py"
    echo ""
    echo "# Test with PYTHONPATH:"
    echo "docker-compose exec whisper-worker sh -c \"cd /app && PYTHONPATH=/app:. python -c 'import celery_app'\""
    echo ""
    echo "📝 Once tests pass, run the final fix script!"
else
    echo "❌ Container still not stable"
    echo "Checking logs..."
    docker-compose logs whisper-worker --tail 10
fi