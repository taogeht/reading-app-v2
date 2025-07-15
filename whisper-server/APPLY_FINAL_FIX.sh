#!/bin/bash
# Apply Final Fix: Restore Working Celery Command
# Run this AFTER the restart loop is fixed and import tests pass

set -e  # Exit on any error

echo "🎯 Applying Final Celery Worker Fix"
echo "===================================="

# Check if container is running first
if ! docker-compose ps | grep -q "whisper-celery-worker.*Up"; then
    echo "❌ Worker container not running. Run FIX_RESTART_LOOP.sh first!"
    exit 1
fi

# Test import before applying fix
echo "🧪 Testing import before applying fix..."
if docker-compose exec -T whisper-worker sh -c "cd /app && python -c 'import celery_app'" 2>/dev/null; then
    echo "✅ Import test passed - applying fix..."
else
    echo "❌ Import test failed - need to debug file locations first"
    echo "Run these diagnostic commands:"
    echo "docker-compose exec whisper-worker ls -la /app/celery_app.py"
    echo "docker-compose exec whisper-worker python -c \"import sys; print('\\\\n'.join(sys.path))\""
    exit 1
fi

# Apply the working command
echo "🔧 Updating docker-compose.yml with working command..."
sed -i.tmp 's/command: sleep infinity/command: sh -c "cd \/app \&\& PYTHONPATH=\/app:. python -m celery -A celery_app worker --loglevel=info --concurrency=2 --queues=audio_processing,batch_processing,default"/' docker-compose.yml

# Check if the replacement worked
if grep -q "python -m celery -A celery_app worker" docker-compose.yml; then
    echo "✅ Docker compose updated with working command"
else
    echo "❌ Failed to update docker-compose.yml automatically"
    echo "Please manually edit docker-compose.yml and change:"
    echo "  FROM: command: sleep infinity"
    echo "  TO:   command: sh -c \"cd /app && PYTHONPATH=/app:. python -m celery -A celery_app worker --loglevel=info --concurrency=2 --queues=audio_processing,batch_processing,default\""
    exit 1
fi

# Restart worker with new command
echo "🔄 Restarting worker with fixed command..."
docker-compose restart whisper-worker

# Wait for startup
echo "⏳ Waiting for worker startup..."
sleep 10

# Check final status
echo "📊 Checking final status..."
if docker-compose logs whisper-worker --tail 5 | grep -q "celery@.*ready"; then
    echo "🎉 SUCCESS! Celery worker is now running properly!"
    echo ""
    echo "✅ Worker Status:"
    docker-compose ps | grep whisper
    echo ""
    echo "📋 Recent Logs:"
    docker-compose logs whisper-worker --tail 10
    echo ""
    echo "🧪 Testing worker ping..."
    if docker-compose exec -T whisper-worker celery -A celery_app inspect ping 2>/dev/null; then
        echo "✅ Worker ping successful!"
        echo ""
        echo "🎯 Queue Processing:"
        echo "Your pending job should now process automatically!"
        echo "Check status: curl http://192.168.1.26:8000/queue/status/d95343de-cb77-469d-9144-3260b9832af2"
    else
        echo "⚠️ Worker running but ping failed - check Redis connection"
    fi
else
    echo "❌ Worker still having issues. Checking logs..."
    docker-compose logs whisper-worker --tail 20
    echo ""
    echo "Try these manual tests:"
    echo "docker-compose exec whisper-worker celery -A celery_app inspect ping"
fi