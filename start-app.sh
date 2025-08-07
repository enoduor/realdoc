#!/bin/bash

# CreatorSync App Startup Script
echo "🚀 Starting CreatorSync App..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}❌ Port $1 is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $1 is available${NC}"
        return 0
    fi
}

# Function to kill processes on specific ports
kill_port() {
    echo -e "${YELLOW}🔄 Stopping processes on port $1...${NC}"
    pkill -f ":$1" 2>/dev/null || true
    sleep 2
}

# Check and kill existing processes
echo -e "${BLUE}📋 Checking for existing processes...${NC}"
kill_port 3000  # Frontend
kill_port 4001  # Node.js backend
kill_port 5001  # Python backend

# Wait a moment for processes to stop
sleep 3

# Check ports are available
echo -e "${BLUE}🔍 Checking port availability...${NC}"
check_port 3000 || exit 1
check_port 4001 || exit 1
check_port 5001 || exit 1

# Start Node.js Backend (Authentication)
echo -e "${BLUE}🔐 Starting Node.js Backend (Auth)...${NC}"
cd back/backend-node
if [ ! -f "node_modules/.bin/nodemon" ]; then
    echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
    npm install
fi

# Start Node.js backend in background
npm start > ../node-backend.log 2>&1 &
NODE_PID=$!
echo -e "${GREEN}✅ Node.js Backend started (PID: $NODE_PID)${NC}"

# Start Python Backend (AI Services)
echo -e "${BLUE}🤖 Starting Python Backend (AI Services)...${NC}"
cd ../backend-python

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}🐍 Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies if needed
if [ ! -f "requirements.txt" ] || [ ! -d "venv/lib/python*/site-packages/fastapi" ]; then
    echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
    pip install -r requirements.txt
fi

# Start Python backend in background
python3 -m uvicorn main:app --host 0.0.0.0 --port 5001 --reload > ../python-backend.log 2>&1 &
PYTHON_PID=$!
echo -e "${GREEN}✅ Python Backend started (PID: $PYTHON_PID)${NC}"

# Start Frontend (React)
echo -e "${BLUE}⚛️  Starting React Frontend...${NC}"
cd ../../frontend

# Install frontend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing Frontend dependencies...${NC}"
    npm install
fi

# Start React frontend in background
npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✅ React Frontend started (PID: $FRONTEND_PID)${NC}"

# Wait for services to start
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 10

# Check if services are running
echo -e "${BLUE}🔍 Checking service status...${NC}"

# Check Node.js backend
if curl -s http://localhost:4001 > /dev/null; then
    echo -e "${GREEN}✅ Node.js Backend is running on http://localhost:4001${NC}"
else
    echo -e "${RED}❌ Node.js Backend failed to start${NC}"
fi

# Check Python backend
if curl -s http://localhost:5001/docs > /dev/null; then
    echo -e "${GREEN}✅ Python Backend is running on http://localhost:5001${NC}"
else
    echo -e "${RED}❌ Python Backend failed to start${NC}"
fi

# Check React frontend
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ React Frontend is running on http://localhost:3000${NC}"
else
    echo -e "${RED}❌ React Frontend failed to start${NC}"
fi

echo ""
echo -e "${GREEN}🎉 CreatorSync App is starting up!${NC}"
echo ""
echo -e "${BLUE}📱 Frontend:     http://localhost:3000${NC}"
echo -e "${BLUE}🔐 Auth API:     http://localhost:4001${NC}"
echo -e "${BLUE}🤖 AI API:       http://localhost:5001${NC}"
echo -e "${BLUE}📚 API Docs:     http://localhost:5001/docs${NC}"
echo ""
echo -e "${YELLOW}💡 To stop all services, run: ./stop-app.sh${NC}"
echo -e "${YELLOW}📋 To view logs, check: back/node-backend.log, back/python-backend.log, frontend.log${NC}"
echo ""

# Save PIDs to file for easy stopping
echo "NODE_PID=$NODE_PID" > .app-pids
echo "PYTHON_PID=$PYTHON_PID" >> .app-pids
echo "FRONTEND_PID=$FRONTEND_PID" >> .app-pids

echo -e "${GREEN}✅ All services started successfully!${NC}"
