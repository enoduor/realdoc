#!/bin/bash

# Repostly App Stop Script
echo "🛑 Stopping Repostly App..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to kill processes on specific ports
kill_port() {
    echo -e "${YELLOW}🔄 Stopping processes on port $1...${NC}"
    pkill -f ":$1" 2>/dev/null || true
    sleep 1
}

# Kill processes by PID if .app-pids file exists
if [ -f ".app-pids" ]; then
    echo -e "${BLUE}📋 Stopping processes by PID...${NC}"
    source .app-pids
    
    if [ ! -z "$NODE_PID" ]; then
        echo -e "${YELLOW}🔄 Stopping Node.js Backend (PID: $NODE_PID)...${NC}"
        kill $NODE_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$PYTHON_PID" ]; then
        echo -e "${YELLOW}🔄 Stopping Python Backend (PID: $PYTHON_PID)...${NC}"
        kill $PYTHON_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}🔄 Stopping React Frontend (PID: $FRONTEND_PID)...${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Remove PID file
    rm -f .app-pids
fi

# Also kill by port (backup method)
echo -e "${BLUE}🔍 Stopping processes by port...${NC}"
kill_port 3000  # Frontend
kill_port 4001  # Node.js backend
kill_port 5001  # Python backend

# Wait for processes to stop
sleep 3

# Check if ports are free
echo -e "${BLUE}🔍 Checking if ports are free...${NC}"
if ! lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Port 3000 (Frontend) is free${NC}"
else
    echo -e "${RED}❌ Port 3000 still in use${NC}"
fi

if ! lsof -Pi :4001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Port 4001 (Node.js Backend) is free${NC}"
else
    echo -e "${RED}❌ Port 4001 still in use${NC}"
fi

if ! lsof -Pi :5001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Port 5001 (Python Backend) is free${NC}"
else
    echo -e "${RED}❌ Port 5001 still in use${NC}"
fi

echo ""
echo -e "${GREEN}✅ All Repostly services stopped!${NC}"
echo -e "${YELLOW}💡 To start the app again, run: ./start-app.sh${NC}"
