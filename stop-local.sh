#!/bin/bash

# Stop all RealDoc services

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }

log "Stopping RealDoc services..."

# Kill by PID files
if [ -f ".node-pid" ]; then
    NODE_PID=$(cat .node-pid)
    kill $NODE_PID 2>/dev/null || true
    rm -f .node-pid
fi

if [ -f ".python-pid" ]; then
    PYTHON_PID=$(cat .python-pid)
    kill $PYTHON_PID 2>/dev/null || true
    rm -f .python-pid
fi

if [ -f ".frontend-pid" ]; then
    FRONTEND_PID=$(cat .frontend-pid)
    kill $FRONTEND_PID 2>/dev/null || true
    rm -f .frontend-pid
fi

# Kill by port
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:4001 | xargs kill -9 2>/dev/null || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true

success "All services stopped"
