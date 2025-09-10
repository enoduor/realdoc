# Complete Repostly Docker Container for Local Testing (ALB-ready)
FROM node:20-bookworm-slim AS base

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl python3 python3-pip python3-venv \
 && rm -rf /var/lib/apt/lists/*

# ========== AI Backend (Python) ==========
FROM base AS ai-builder
WORKDIR /app/ai
COPY back/backend-python/requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt \
 && pip3 list | grep -E "(fastapi|uvicorn|openai)" || true
COPY back/backend-python/ ./

# ========== API Backend (Node.js) ==========
FROM base AS api-builder
WORKDIR /app/api
COPY back/backend-node/package*.json ./
RUN npm install --omit=dev --no-optional --no-audit --no-fund
COPY back/backend-node/ ./

# ========== Frontend (React) ==========
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Build-time args (optional)
ARG REACT_APP_API_URL
ARG REACT_APP_AI_API
ARG REACT_APP_CLERK_PUBLISHABLE_KEY
ARG PUBLIC_URL="/"

ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_AI_API=${REACT_APP_AI_API}
ENV REACT_APP_CLERK_PUBLISHABLE_KEY=${REACT_APP_CLERK_PUBLISHABLE_KEY}
ENV PUBLIC_URL=${PUBLIC_URL}

COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund --silent
COPY frontend/ ./
RUN echo "PUBLIC_URL=${PUBLIC_URL}" && \
    echo "REACT_APP_API_URL=${REACT_APP_API_URL}" && \
    echo "REACT_APP_AI_API=${REACT_APP_AI_API}" && \
    echo "REACT_APP_CLERK_PUBLISHABLE_KEY=${REACT_APP_CLERK_PUBLISHABLE_KEY}" && \
    npm run build

# ========== Final Runtime (single container) ==========
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
# IMPORTANT for ALB: external path is /ai/*
ENV AI_ROOT_PATH=/ai

# App code
COPY --from=ai-builder /app/ai ./ai

# AI deps (installed AFTER copying code)
RUN pip3 install --no-cache-dir --break-system-packages -r ai/requirements.txt
COPY --from=api-builder /app/api ./api
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Static file server
RUN npm install -g serve

# Startup script
RUN printf '%s\n' '#!/bin/bash' \
  'set -e' \
  'echo "🚀 Starting Repostly services..."' \
  '' \
  'export AI_ROOT_PATH=${AI_ROOT_PATH:-/ai}' \
  'echo "🤖 AI_ROOT_PATH=${AI_ROOT_PATH}"' \
  '' \
  'echo "🤖 Starting AI service on :5001 (external path ${AI_ROOT_PATH})..."' \
  'cd /app/ai && python3 -m uvicorn main:app --host 0.0.0.0 --port 5001 &' \
  'AI_PID=$!' \
  '' \
  'echo "🔧 Starting API service on :4001..."' \
  'cd /app/api && node index.js &' \
  'API_PID=$!' \
  '' \
  'sleep 2' \
  'kill -0 "$AI_PID" 2>/dev/null || { echo "❌ AI failed"; exit 1; }' \
  'kill -0 "$API_PID" 2>/dev/null || { echo "❌ API failed"; exit 1; }' \
  '' \
  'echo "🌐 Starting frontend on :3000..."' \
  'cd /app && serve -s frontend/build -l 3000' \
> /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000 4001 5001

# Healthcheck (container-internal): FastAPI answers /ping (root_path is external)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:5001/ping || exit 1

CMD ["/app/start.sh"]