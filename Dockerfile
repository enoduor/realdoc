# ================== Base ==================
FROM node:20-bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl python3 python3-pip python3-venv \
 && rm -rf /var/lib/apt/lists/*

# ================== AI builder ==================
FROM base AS ai-builder
WORKDIR /app/ai
COPY back/backend_python/requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt \
 && python3 -c "import fastapi, uvicorn, pydantic, starlette; print('✅ ai builder deps ok')"
COPY back/backend_python/ ./

# ================== API builder ==================
FROM base AS api-builder
WORKDIR /app/api
COPY back/backend-node/package*.json ./
RUN npm install --omit=dev --no-optional --no-audit --no-fund
COPY back/backend-node/ ./

# ================== Frontend builder ==================
FROM node:20-bookworm-slim AS frontend-builder
ENV DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true
WORKDIR /app/frontend

ARG REACT_APP_API_URL
ARG REACT_APP_AI_API
ARG REACT_APP_PYTHON_API_URL
ARG REACT_APP_CLERK_PUBLISHABLE_KEY
ARG PUBLIC_URL="/"

# Minimal toolchain for native npm builds
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Build-time env
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_AI_API=${REACT_APP_AI_API}
ENV REACT_APP_PYTHON_API_URL=${REACT_APP_PYTHON_API_URL:-${REACT_APP_AI_API}}
ENV PUBLIC_URL=${PUBLIC_URL}
ENV REACT_APP_CLERK_PUBLISHABLE_KEY=${REACT_APP_CLERK_PUBLISHABLE_KEY}

COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund --silent   # 👈 swapped back from npm ci

COPY frontend/ ./
RUN echo "PUBLIC_URL=${PUBLIC_URL}" && \
    echo "REACT_APP_API_URL=${REACT_APP_API_URL}" && \
    echo "REACT_APP_AI_API=${REACT_APP_AI_API}" && \
    echo "REACT_APP_PYTHON_API_URL=${REACT_APP_PYTHON_API_URL:-${REACT_APP_AI_API}}" && \
    echo "REACT_APP_CLERK_PUBLISHABLE_KEY=${REACT_APP_CLERK_PUBLISHABLE_KEY}" && \
    NODE_OPTIONS="--max-old-space-size=2048" npm run build

# ================== Runtime ==================
FROM node:20-bookworm-slim AS runtime
ENV DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl python3 python3-pip python3-venv \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV AI_ROOT_PATH=/ai

# ---- AI (Python) ----
COPY back/backend_python/requirements.txt ./ai/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r ai/requirements.txt \
 && python3 -c "import fastapi, uvicorn, pydantic, starlette; print('✅ python deps ok')"
COPY back/backend_python/ ./ai

# ---- API (Node) ----
COPY --from=api-builder /app/api ./api

# ---- Frontend ----
COPY --from=frontend-builder /app/frontend/build ./frontend/build

RUN npm install -g serve

# ---- Startup script ----
RUN printf '%s\n' '#!/bin/bash' \
  'set -euo pipefail' \
  'echo "🚀 Starting Repostly services..."' \
  'export AI_ROOT_PATH="${AI_ROOT_PATH:-/ai}"' \
  'echo "🤖 AI_ROOT_PATH=${AI_ROOT_PATH}"' \
  'trap "echo Stopping...; kill -TERM ${AI_PID:-0} ${API_PID:-0} || true" TERM INT EXIT' \
  'echo "🤖 Starting AI service on :5001 (root-path ${AI_ROOT_PATH})..."' \
  'cd /app/ai && python3 -m uvicorn main:app --host 0.0.0.0 --port 5001 --root-path "${AI_ROOT_PATH}" &' \
  'AI_PID=$!' \
  'echo "🔧 Starting API service on :4001..."' \
  'cd /app/api && node index.js &' \
  'API_PID=$!' \
  'sleep 2' \
  'kill -0 "$AI_PID" 2>/dev/null || { echo "❌ AI failed"; exit 1; }' \
  'kill -0 "$API_PID" 2>/dev/null || { echo "❌ API failed"; exit 1; }' \
  'echo "🌐 Starting frontend on :3000..."' \
  'cd /app && exec serve -s frontend/build -l 3000' \
> /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000 4001 5001
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:5001/ai/ping || curl -fsS http://localhost:5001/ping || exit 1

CMD ["/app/start.sh"]