# Complete Repostly Docker Container for Local Testing
FROM node:20-bookworm-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# ========== AI Backend (Python) ==========
FROM base AS ai-builder
WORKDIR /app/ai

# Install Python packages globally (simpler for Docker)
COPY back/backend-python/requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt && \
    pip3 list | grep -E "(fastapi|uvicorn|openai)" || echo "Package installation verification failed"

# Copy Python application
COPY back/backend-python/ ./

# ========== API Backend (Node.js) ==========
FROM base AS api-builder
WORKDIR /app/api

# Copy package files and install dependencies
COPY back/backend-node/package*.json ./
RUN npm install --omit=dev --no-optional --no-audit --no-fund

# Copy Node.js application
COPY back/backend-node/ ./

# ========== Frontend (React) ==========
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund --silent

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# ========== Final Runtime ==========
FROM base AS runtime
WORKDIR /app

# Copy AI service
COPY --from=ai-builder /app/ai ./ai

# Copy API service
COPY --from=api-builder /app/api ./api

# Copy built frontend
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Install serve for frontend
RUN npm install -g serve

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Start AI service in background\n\
cd /app/ai && python3 -m uvicorn main:app --host 0.0.0.0 --port 5001 &\n\
\n\
# Start API service in background\n\
cd /app/api && npm start &\n\
\n\
# Start frontend service\n\
cd /app && serve -s frontend/build -l 3000\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose ports
EXPOSE 3000 4001 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5001/ping || exit 1

# Start all services
CMD ["/app/start.sh"]
