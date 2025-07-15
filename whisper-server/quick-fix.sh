#!/bin/bash
# Quick Fix Script - No Rebuild Required!
# Fixes Celery worker in 30 seconds instead of 20 minutes

set -e

echo "🚀 Quick Fix: Celery Worker (No Rebuild Required)"
echo "=============================================="
echo "⏱️  This will take ~30 seconds instead of 20 minutes!"
echo

# Check if we're in the right directory
if [ ! -f "celery_app.py" ]; then
    echo "❌ Error: celery_app.py not found in current directory"
    echo "Please run this script from the whisper-server directory"
    echo "cd /mnt/user/appdata/whisper-server"
    exit 1
fi

echo "📋 Step 1: Copying files to running containers..."

# Copy files directly into running containers
echo "  📄 Copying celery_app.py to worker container..."
docker cp celery_app.py whisper-celery-worker:/app/

echo "  📄 Copying tasks.py to worker container..."
docker cp tasks.py whisper-celery-worker:/app/

echo "  📄 Copying main.py to server container..."
docker cp main.py whisper-speech-server:/app/

echo "  📄 Copying queue_endpoints.py to server container..."
docker cp queue_endpoints.py whisper-speech-server:/app/

echo "✅ Files copied successfully!"
echo

echo "🔄 Step 2: Restarting containers (fast restart, no rebuild)..."

# Quick restart of just the affected containers
docker-compose restart whisper-worker whisper-server

echo "✅ Containers restarted!"
echo

echo "⏳ Step 3: Waiting for services to start..."
sleep 5

echo "🧪 Step 4: Quick verification..."

# Check container status
echo "📊 Container Status:"
docker-compose ps

echo
echo "📋 Worker Logs (last 10 lines):"
docker-compose logs whisper-worker --tail 10

echo
echo "🏓 Testing Worker Connection:"
if docker-compose exec -T whisper-worker celery -A celery_app inspect ping > /dev/null 2>&1; then
    echo "✅ Worker is responding!"
else
    echo "⚠️  Worker not responding yet (may need a moment)"
fi

echo
echo "🌐 Testing API Endpoints:"

# Test health endpoint
if curl -s http://192.168.1.26:8000/health > /dev/null; then
    echo "✅ API server is responding!"
else
    echo "⚠️  API server not responding yet"
fi

echo
echo "🎉 Quick Fix Complete!"
echo
echo "🧪 Next Steps:"
echo "1. Check worker status:"
echo "   docker-compose exec whisper-worker celery -A celery_app inspect ping"
echo
echo "2. Test queue endpoints:"
echo "   curl http://192.168.1.26:8000/queue/queue-stats"
echo
echo "3. Check if pending job processes:"
echo "   curl http://192.168.1.26:8000/queue/status/d95343de-cb77-469d-9144-3260b9832af2"
echo
echo "💡 If worker still not working, check logs:"
echo "   docker-compose logs whisper-worker"
echo

echo "⏱️  Total time: ~30 seconds (vs 20 minutes for rebuild!)"