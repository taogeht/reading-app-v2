#!/bin/bash
# Development build script with volume mounts
# Ultra-fast builds: ~30 seconds after initial setup

set -e

# Configuration
DOCKERFILE="Dockerfile.optimized"
IMAGE_NAME="whisper-server-dev"
TAG="latest"

# Enable BuildKit
export DOCKER_BUILDKIT=1

echo "🛠️  Starting development build..."
echo "This will be fast after the first build!"
echo

# Build development target
echo "📦 Building development image with volume mounts..."
docker build \
  --file "$DOCKERFILE" \
  --target development \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --cache-from "$IMAGE_NAME:$TAG" \
  --tag "$IMAGE_NAME:$TAG" \
  .

echo "✅ Development build completed!"
echo

# Start development environment
echo "🚀 Starting development environment..."
echo "Code changes will be reflected instantly (no rebuild needed)"
echo

docker-compose -f docker-compose.dev.yml up -d

echo
echo "📊 Development environment status:"
docker-compose -f docker-compose.dev.yml ps

echo
echo "🎯 Development URLs:"
echo "  API Server: http://localhost:8000"
echo "  API Docs:   http://localhost:8000/docs"
echo "  Health:     http://localhost:8000/health"
echo
echo "📝 View logs:"
echo "  docker-compose -f docker-compose.dev.yml logs -f"