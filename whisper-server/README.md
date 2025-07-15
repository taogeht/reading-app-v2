# Whisper Speech Analysis Server

AI-powered speech-to-text service for the Reading Recording Practice application, optimized for unRAID deployment.

## Features

- **OpenAI Whisper Integration** - High-accuracy speech transcription
- **Reading Analysis** - Words per minute, pause detection, fluency scoring
- **FastAPI REST API** - Modern async API with automatic documentation
- **Health Monitoring** - Built-in health checks and logging
- **unRAID Optimized** - Docker configuration tailored for unRAID servers
- **GPU Support** - Automatic GPU detection and utilization when available

## Quick Start for unRAID

### 1. Prepare Directories

Create the necessary directories on your unRAID server:

```bash
mkdir -p /mnt/user/appdata/whisper/{models,redis,logs}
```

### 2. Deploy Container

1. Copy the entire `whisper-server` folder to your unRAID server
2. Navigate to the folder: `cd /path/to/whisper-server`
3. Copy environment file: `cp .env.example .env`
4. Edit `.env` to match your unRAID paths
5. Start the services: `docker-compose up -d`

### 3. Verify Installation

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs whisper-server

# Test API
curl http://your-unraid-ip:8000/health
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and model information.

### Synchronous Processing

#### Transcribe Audio
```
POST /transcribe
Content-Type: multipart/form-data
Body: audio_file (WAV, MP3, M4A, etc.)
```

#### Analyze with Expected Text
```
POST /analyze
Content-Type: multipart/form-data
Body: 
  - audio_file: Audio recording
  - expected_text: Expected transcript for accuracy scoring
```

### Asynchronous Queue System

#### Submit Job for Processing
```
POST /queue/submit
Content-Type: multipart/form-data
Body:
  - audio_file: Audio file to process
  - model: Whisper model (tiny, base, small, medium, large)
  - expected_text: Optional expected text for accuracy
  - expected_wpm: Expected words per minute (default: 100)

Response: {"job_id": "uuid", "status": "PENDING", "message": "..."}
```

#### Check Job Status
```
GET /queue/status/{job_id}

Response: {
  "job_id": "uuid",
  "status": "PENDING|PROGRESS|SUCCESS|FAILURE",
  "ready": false,
  "progress": {"status": "Transcribing audio", "progress": 30},
  "result": {...}  // When completed
}
```

#### Submit Batch Processing
```
POST /queue/submit-batch
Content-Type: multipart/form-data
Body: Multiple audio files + options

Response: {
  "batch_id": "uuid",
  "total_files": 5,
  "job_ids": [...],
  "status": "SUBMITTED"
}
```

#### Monitor Queue System
```
GET /queue/active-jobs     # List currently processing jobs
GET /queue/queue-stats     # Worker and queue statistics
DELETE /queue/cancel/{job_id}  # Cancel a job
```

## Model Selection

Choose the appropriate Whisper model in your `.env` file:

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| `tiny` | 39MB | Fastest | Basic | Testing/Development |
| `base` | 142MB | Fast | Good | **Recommended for most users** |
| `small` | 487MB | Medium | Better | Higher accuracy needs |
| `medium` | 1.5GB | Slow | High | Production with good hardware |
| `large` | 3GB | Slowest | Best | Maximum accuracy, requires 8GB+ RAM |

## Hardware Requirements

### Minimum (base model):
- **CPU**: 2 cores
- **RAM**: 2GB
- **Storage**: 1GB

### Recommended (base model):
- **CPU**: 4 cores
- **RAM**: 4GB
- **Storage**: 2GB
- **GPU**: Optional but significantly improves performance

### GPU Support
The container automatically detects and uses NVIDIA GPUs when available. For unRAID:

1. Install the NVIDIA driver plugin
2. Enable GPU support in Docker settings
3. Add `--gpus all` to container runtime settings

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL` | `base` | Whisper model to use |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8000` | Server port |
| `LOG_LEVEL` | `INFO` | Logging level |
| `TZ` | `America/New_York` | Container timezone |

### Resource Limits

Adjust in `docker-compose.yml` based on your server:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'      # CPU cores
      memory: 4G       # RAM limit
```

## Integration with Reading App

The Whisper server provides the speech analysis backend for the main reading application. Configure your app to point to:

```
http://your-unraid-ip:8000
```

## Monitoring

### Logs
```bash
# View real-time logs
docker-compose logs -f whisper-server

# Check log files
tail -f /mnt/user/appdata/whisper/logs/whisper.log
```

### Health Monitoring
The health endpoint returns detailed status:

```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_name": "base",
  "gpu_available": false
}
```

## Troubleshooting

### Common Issues

1. **Model Download Fails**
   - Check internet connection
   - Verify sufficient disk space
   - Try a smaller model first

2. **High Memory Usage**
   - Use a smaller model (`tiny` or `base`)
   - Reduce concurrent processing
   - Add swap space to unRAID

3. **Slow Processing**
   - Enable GPU support
   - Use faster storage (SSD cache)
   - Increase CPU allocation

4. **Container Won't Start**
   - Check unRAID directory permissions
   - Verify docker-compose.yml paths
   - Review container logs

### Performance Optimization

1. **Enable GPU**: Install NVIDIA plugin and enable GPU support
2. **Use SSD Cache**: Store models on fast storage
3. **Adjust Model**: Balance accuracy vs. speed needs
4. **Resource Allocation**: Dedicate CPU cores and RAM

## Security Considerations

- Change default CORS settings for production
- Consider adding API key authentication
- Use HTTPS proxy for external access
- Regularly update container images

## API Documentation

Once running, visit `http://your-unraid-ip:8000/docs` for interactive API documentation.

## Support

For issues specific to the Reading Recording Practice integration, check the main application logs and ensure the Whisper server URL is correctly configured.