# Whisper API Server for Reading Recording Practice
# Optimized for unRAID deployment with GPU support

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    openai-whisper \
    fastapi \
    uvicorn \
    python-multipart \
    pydantic \
    torch \
    torchaudio \
    numpy \
    python-dotenv \
    redis \
    celery

# Create directories for models and uploads
RUN mkdir -p /app/models /app/uploads /app/logs

# Copy application code
COPY app/ /app/
COPY requirements.txt /app/

# Install additional requirements if any
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# Create non-root user for security
RUN useradd -m -u 1000 whisper && \
    chown -R whisper:whisper /app
USER whisper

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]