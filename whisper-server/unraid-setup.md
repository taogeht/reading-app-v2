# unRAID Setup Guide for Whisper Server

## Pre-Installation Checklist

### 1. unRAID Requirements
- unRAID 6.8+ (for Docker support)
- Minimum 4GB RAM available
- 2GB free storage space
- Internet connection for model downloads

### 2. Optional: GPU Setup
If you have an NVIDIA GPU and want accelerated processing:

1. Install **NVIDIA Driver** plugin from Community Applications
2. Enable GPU support in **Settings > Docker**
3. Reboot unRAID after GPU driver installation

## Installation Steps

### Step 1: Prepare Directories

SSH into your unRAID server and create the necessary directories:

```bash
mkdir -p /mnt/user/appdata/whisper
mkdir -p /mnt/user/appdata/whisper/models
mkdir -p /mnt/user/appdata/whisper/redis
mkdir -p /mnt/user/appdata/whisper/logs

# Set proper permissions
chmod -R 755 /mnt/user/appdata/whisper
```

### Step 2: Upload Files

Transfer the whisper-server folder to your unRAID server. You can:

**Option A: Direct copy**
```bash
# Copy entire folder to unRAID
scp -r whisper-server root@your-unraid-ip:/mnt/user/appdata/
```

**Option B: Create manually**
```bash
# Create the directory
mkdir -p /mnt/user/appdata/whisper-server

# Copy files individually via your preferred method
# (WinSCP, FileZilla, unRAID GUI, etc.)
```

### Step 3: Configure Environment

```bash
cd /mnt/user/appdata/whisper-server
cp .env.example .env
nano .env  # Edit configuration
```

Key settings to adjust:
```env
WHISPER_MODEL=base  # Start with 'base', upgrade later if needed
TZ=America/New_York  # Your timezone
APPDATA_PATH=/mnt/user/appdata/whisper
```

### Step 4: Deploy Container

```bash
cd /mnt/user/appdata/whisper-server
docker-compose up -d
```

### Step 5: Verify Installation

```bash
# Check container status
docker-compose ps

# Should show:
# whisper-speech-server   Up   0.0.0.0:8000->8000/tcp
# whisper-redis          Up   0.0.0.0:6379->6379/tcp

# Check logs
docker-compose logs whisper-server

# Test API
curl http://localhost:8000/health
```

Expected health response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_name": "base",
  "gpu_available": false
}
```

## unRAID Docker Template (Alternative Method)

If you prefer using unRAID's Docker interface, create a template:

### Container Settings:
- **Name**: `whisper-speech-server`
- **Repository**: Build from local Dockerfile
- **Network Type**: `Bridge`
- **Port**: `8000:8000`

### Volume Mappings:
| Host Path | Container Path | Mode |
|-----------|----------------|------|
| `/mnt/user/appdata/whisper/models` | `/root/.cache/whisper` | RW |
| `/mnt/user/appdata/whisper/logs` | `/app/logs` | RW |
| `/tmp/whisper-uploads` | `/app/uploads` | RW |

### Environment Variables:
| Variable | Value |
|----------|-------|
| `WHISPER_MODEL` | `base` |
| `TZ` | `America/New_York` |
| `PYTHONUNBUFFERED` | `1` |

## Performance Tuning for unRAID

### 1. Resource Allocation

Edit `docker-compose.yml` based on your server specs:

**For 16GB+ RAM servers:**
```yaml
deploy:
  resources:
    limits:
      cpus: '4.0'
      memory: 8G
```

**For 8GB RAM servers:**
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 4G
```

### 2. Storage Optimization

**Use Cache Drive for Models (Recommended):**
```bash
# Move models to cache drive for faster access
mkdir -p /mnt/cache/appdata/whisper/models
ln -s /mnt/cache/appdata/whisper/models /mnt/user/appdata/whisper/models
```

**Tmpfs for Uploads (Performance):**
Add to docker-compose.yml:
```yaml
tmpfs:
  - /app/uploads:size=1G,uid=1000
```

### 3. GPU Acceleration Setup

If you have an NVIDIA GPU:

1. **Install NVIDIA Plugin:**
   - Go to **Apps** tab in unRAID
   - Search for "NVIDIA Driver"
   - Install and reboot

2. **Update docker-compose.yml:**
```yaml
services:
  whisper-server:
    # Add this section
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
```

3. **Verify GPU Access:**
```bash
docker exec whisper-speech-server nvidia-smi
```

## Model Management

### Model Storage Location
Models are stored in: `/mnt/user/appdata/whisper/models`

### Model Sizes and Download Times
| Model | Size | Download Time (100Mbps) |
|-------|------|-------------------------|
| tiny | 39MB | ~3 seconds |
| base | 142MB | ~11 seconds |
| small | 487MB | ~39 seconds |
| medium | 1.5GB | ~2 minutes |
| large | 3GB | ~4 minutes |

### Changing Models
```bash
# Stop container
docker-compose stop whisper-server

# Edit environment
nano .env
# Change WHISPER_MODEL=small

# Restart container
docker-compose up -d whisper-server

# Monitor download progress
docker-compose logs -f whisper-server
```

## Monitoring and Maintenance

### Log Management
```bash
# View current logs
docker-compose logs whisper-server

# Monitor real-time
docker-compose logs -f whisper-server

# Rotate logs (add to cron)
find /mnt/user/appdata/whisper/logs -name "*.log" -size +100M -delete
```

### Health Monitoring
Set up a simple monitoring script:

```bash
#!/bin/bash
# /mnt/user/appdata/whisper/health-check.sh

HEALTH=$(curl -s http://localhost:8000/health | jq -r '.status')
if [ "$HEALTH" != "healthy" ]; then
    echo "$(date): Whisper server unhealthy" >> /var/log/whisper-monitor.log
    # Optional: restart container
    # docker-compose -f /mnt/user/appdata/whisper-server/docker-compose.yml restart whisper-server
fi
```

Add to cron:
```bash
# Check every 5 minutes
*/5 * * * * /mnt/user/appdata/whisper/health-check.sh
```

## Integration with Reading App

Once deployed, configure your main reading application to use:

```
WHISPER_SERVER_URL=http://your-unraid-ip:8000
```

## Troubleshooting

### Common Issues

**Container Won't Start:**
```bash
# Check permissions
ls -la /mnt/user/appdata/whisper-server/

# Check available resources
free -h
df -h
```

**Model Download Fails:**
```bash
# Check internet connectivity
ping github.com

# Check available space
df -h /mnt/user/appdata/whisper/
```

**High CPU/Memory Usage:**
- Use smaller model (tiny/base)
- Reduce concurrent requests
- Add more RAM to unRAID server

**GPU Not Detected:**
```bash
# Verify NVIDIA plugin
ls /dev/nvidia*

# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

### Performance Issues

1. **Slow transcription**: Enable GPU or use faster storage
2. **Memory leaks**: Restart container weekly via cron
3. **Network timeouts**: Increase timeout values in app

## Backup and Recovery

### Backup Configuration
```bash
# Backup entire configuration
tar -czf whisper-backup-$(date +%Y%m%d).tar.gz /mnt/user/appdata/whisper-server/
```

### Restore from Backup
```bash
# Stop services
docker-compose down

# Restore files
tar -xzf whisper-backup-YYYYMMDD.tar.gz -C /

# Restart services
docker-compose up -d
```

## Updates

### Update Container
```bash
cd /mnt/user/appdata/whisper-server
docker-compose pull
docker-compose up -d
```

### Update Whisper Models
Models auto-update when you change `WHISPER_MODEL` in `.env`.