#!/bin/bash
# Queue Monitoring Script
# Use this to monitor Celery workers and queue status

echo "=== Whisper Queue System Status ==="
echo

# Check if Redis is running
echo "🔴 Redis Status:"
redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6379} ping 2>/dev/null || echo "  ❌ Redis not accessible"

echo

# Check active workers
echo "👷 Active Workers:"
celery -A app.celery_app inspect active 2>/dev/null || echo "  ❌ No workers responding"

echo

# Check queued tasks
echo "📋 Queue Status:"
celery -A app.celery_app inspect reserved 2>/dev/null || echo "  ❌ Cannot inspect queues"

echo

# Check worker stats
echo "📊 Worker Stats:"
celery -A app.celery_app inspect stats 2>/dev/null || echo "  ❌ Cannot get worker stats"

echo

# Check registered tasks
echo "🔧 Registered Tasks:"
celery -A app.celery_app inspect registered 2>/dev/null || echo "  ❌ Cannot get registered tasks"