#!/bin/bash
# Optimized build script with cache strategies
# Reduces build times from 20 minutes to ~5 minutes

set -e

# Configuration
DOCKERFILE="Dockerfile.optimized"
IMAGE_NAME="whisper-server"
TAG="latest"

# Enable BuildKit for advanced caching
export DOCKER_BUILDKIT=1

echo "🚀 Starting optimized Docker build..."
echo "Dockerfile: $DOCKERFILE"
echo "Image: $IMAGE_NAME:$TAG"
echo

# Build with cache mounts and inline cache
echo "📦 Building with cache optimization..."
docker build \
  --file "$DOCKERFILE" \
  --target application \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --cache-from "$IMAGE_NAME:$TAG" \
  --tag "$IMAGE_NAME:$TAG" \
  .

echo "✅ Build completed successfully!"
echo

# Show image size
echo "📊 Image information:"
docker images "$IMAGE_NAME:$TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo
echo "🎯 Usage:"
echo "  Development: docker-compose -f docker-compose.dev.yml up"
echo "  Production:  docker-compose -f docker-compose.prod.yml up"