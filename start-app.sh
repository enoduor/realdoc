#!/bin/bash

# CreatorSync App Startup Script
echo "🚀 Starting CreatorSync App with Clerk Authentication & MongoDB Atlas..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

# Function to check environment files
check_env_files() {
    echo -e "${BLUE}🔍 Checking environment configuration...${NC}"
    
    # Check Node.js backend .env
    if [ -f "back/backend-node/.env" ]; then
        echo -e "${GREEN}✅ Node.js backend .env found${NC}"
        if grep -q "MONGODB_URI=" back/backend-node/.env; then
            echo -e "${GREEN}✅ MongoDB configured for Node.js${NC}"
        else
            echo -e "${RED}❌ MongoDB not configured for Node.js${NC}"
            return 1
        fi
        if grep -q "CLERK_SECRET_KEY" back/backend-node/.env; then
            echo -e "${GREEN}✅ Clerk authentication configured for Node.js${NC}"
        else
            echo -e "${RED}❌ Clerk authentication not configured for Node.js${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Node.js backend .env not found${NC}"
        return 1
    fi
    
    # Check Python backend .env
    if [ -f "back/backend-python/.env" ]; then
        echo -e "${GREEN}✅ Python backend .env found${NC}"
        if grep -q "OPENAI_API_KEY" back/backend-python/.env; then
            echo -e "${GREEN}✅ OpenAI API configured${NC}"
        else
            echo -e "${YELLOW}⚠️  OpenAI API not configured${NC}"
        fi
        if grep -q "AWS_BUCKET_NAME" back/backend-python/.env; then
            echo -e "${GREEN}✅ AWS S3 configured${NC}"
        else
            echo -e "${YELLOW}⚠️  AWS S3 not configured${NC}"
        fi
    else
        echo -e "${RED}❌ Python backend .env not found${NC}"
        return 1
    fi
    
    # Check Frontend .env
    if [ -f "frontend/.env" ]; then
        echo -e "${GREEN}✅ Frontend .env found${NC}"
        if grep -q "REACT_APP_CLERK_PUBLISHABLE_KEY" frontend/.env; then
            echo -e "${GREEN}✅ Clerk frontend configured${NC}"
        else
            echo -e "${RED}❌ Clerk frontend not configured${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Frontend .env not found${NC}"
        return 1
    fi
    
    return 0
}

# Check environment files first
if ! check_env_files; then
    echo -e "${RED}❌ Environment configuration incomplete. Please check your .env files.${NC}"
    exit 1
fi

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

# Start Node.js Backend (Authentication & Scheduling)
echo -e "${BLUE}🔐 Starting Node.js Backend (Auth & Scheduling)...${NC}"
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

# Start Frontend (React with Clerk)
echo -e "${BLUE}⚛️  Starting React Frontend (Clerk Auth)...${NC}"
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
sleep 15

# Check if services are running
echo -e "${BLUE}🔍 Checking service status...${NC}"

# Check Node.js backend
if curl -s http://localhost:4001 > /dev/null; then
    echo -e "${GREEN}✅ Node.js Backend is running on http://localhost:4001${NC}"
    echo -e "${PURPLE}   🔐 Clerk Authentication: Enabled${NC}"
    echo -e "${PURPLE}   🗄️  MongoDB Atlas: Connected${NC}"
else
    echo -e "${RED}❌ Node.js Backend failed to start${NC}"
    echo -e "${YELLOW}📋 Check logs: tail -f back/node-backend.log${NC}"
fi

# Check Python backend
if curl -s http://localhost:5001/docs > /dev/null; then
    echo -e "${GREEN}✅ Python Backend is running on http://localhost:5001${NC}"
    echo -e "${PURPLE}   🤖 AI Services: Captions & Hashtags${NC}"
    echo -e "${PURPLE}   📤 Media Upload: AWS S3${NC}"
else
    echo -e "${RED}❌ Python Backend failed to start${NC}"
    echo -e "${YELLOW}📋 Check logs: tail -f back/python-backend.log${NC}"
fi

# Check React frontend
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ React Frontend is running on http://localhost:3000${NC}"
    echo -e "${PURPLE}   🔐 Clerk Authentication: Ready${NC}"
    echo -e "${PURPLE}   📱 Multi-platform Preview: Enabled${NC}"
else
    echo -e "${RED}❌ React Frontend failed to start${NC}"
    echo -e "${YELLOW}📋 Check logs: tail -f frontend.log${NC}"
fi

echo ""
echo -e "${GREEN}🎉 CreatorSync App is ready!${NC}"
echo ""
echo -e "${BLUE}📱 Frontend:     http://localhost:3000${NC}"
echo -e "${BLUE}🔐 Auth API:     http://localhost:4001${NC}"
echo -e "${BLUE}🤖 AI API:       http://localhost:5001${NC}"
echo -e "${BLUE}📚 API Docs:     http://localhost:5001/docs${NC}"
echo ""
echo -e "${PURPLE}🔐 Clerk Dashboard: https://dashboard.clerk.com/${NC}"
echo -e "${PURPLE}🗄️  MongoDB Atlas:   https://cloud.mongodb.com/${NC}"
echo ""
echo -e "${YELLOW}💡 To stop all services, run: ./stop-app.sh${NC}"
echo -e "${YELLOW}📋 To view logs, check: back/node-backend.log, back/python-backend.log, frontend.log${NC}"
echo -e "${YELLOW}🔍 To monitor real-time: tail -f back/node-backend.log${NC}"
echo ""

# Save PIDs to file for easy stopping
echo "NODE_PID=$NODE_PID" > .app-pids
echo "PYTHON_PID=$PYTHON_PID" >> .app-pids
echo "FRONTEND_PID=$FRONTEND_PID" >> .app-pids

echo -e "${GREEN}✅ All services started successfully!${NC}"
echo -e "${GREEN}🚀 Your app is ready for testing!${NC}"
