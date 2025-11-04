#!/bin/bash

# RealDoc App Management Script
# Unified script for starting, stopping, and checking status of RealDoc services

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
    if [ -f "back/backend_python/.env" ]; then
        echo -e "${GREEN}✅ Python backend .env found${NC}"
        if grep -q "OPENAI_API_KEY" back/backend_python/.env; then
            echo -e "${GREEN}✅ OpenAI API configured${NC}"
        else
            echo -e "${YELLOW}⚠️  OpenAI API not configured${NC}"
        fi
        if grep -q "AWS_BUCKET_NAME" back/backend_python/.env; then
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

# Function to start all services
start_services() {
    echo "🚀 Starting RealDoc App with Clerk Authentication & MongoDB Atlas..."
    
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
    cd ../backend_python
    
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
        echo -e "${PURPLE}   🤖 AI Services: Documentation Generation${NC}"
        echo -e "${PURPLE}   📤 OpenAI API: Connected${NC}"
    else
        echo -e "${RED}❌ Python Backend failed to start${NC}"
        echo -e "${YELLOW}📋 Check logs: tail -f back/python-backend.log${NC}"
    fi
    
    # Check React frontend
    if curl -s http://localhost:3000 > /dev/null; then
        echo -e "${GREEN}✅ React Frontend is running on http://localhost:3000${NC}"
        echo -e "${PURPLE}   🔐 Clerk Authentication: Ready${NC}"
        echo -e "${PURPLE}   📚 Documentation Generator: Enabled${NC}"
    else
        echo -e "${RED}❌ React Frontend failed to start${NC}"
        echo -e "${YELLOW}📋 Check logs: tail -f frontend.log${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 RealDoc App is ready!${NC}"
    echo ""
    echo -e "${BLUE}📱 Frontend:     http://localhost:3000${NC}"
    echo -e "${BLUE}🔐 Auth API:     http://localhost:4001${NC}"
    echo -e "${BLUE}🤖 AI API:       http://localhost:5001${NC}"
    echo -e "${BLUE}📚 API Docs:     http://localhost:5001/docs${NC}"
    echo ""
    echo -e "${PURPLE}🔐 Clerk Dashboard: https://dashboard.clerk.com/${NC}"
    echo -e "${PURPLE}🗄️  MongoDB Atlas:   https://cloud.mongodb.com/${NC}"
    echo ""
    echo -e "${YELLOW}💡 To stop all services, run: ./realdoc.sh stop${NC}"
    echo -e "${YELLOW}📋 To view logs, check: back/node-backend.log, back/python-backend.log, frontend.log${NC}"
    echo -e "${YELLOW}🔍 To monitor real-time: tail -f back/node-backend.log${NC}"
    echo ""
    
    # Save PIDs to file for easy stopping
    echo "NODE_PID=$NODE_PID" > .app-pids
    echo "PYTHON_PID=$PYTHON_PID" >> .app-pids
    echo "FRONTEND_PID=$FRONTEND_PID" >> .app-pids
    
    echo -e "${GREEN}✅ All services started successfully!${NC}"
    echo -e "${GREEN}🚀 Your app is ready for testing!${NC}"
}

# Function to stop all services
stop_services() {
    echo "🛑 Stopping RealDoc App..."
    
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
    echo -e "${GREEN}✅ All RealDoc services stopped!${NC}"
    echo -e "${YELLOW}💡 To start the app again, run: ./realdoc.sh start${NC}"
}

# Function to check status of all services
check_status() {
    echo "🔍 RealDoc App Status Check..."
    
    echo -e "${BLUE}📋 Checking service status...${NC}"
    
    # Check Node.js backend
    if curl -s http://localhost:4001 > /dev/null; then
        echo -e "${GREEN}✅ Node.js Backend: http://localhost:4001${NC}"
        echo -e "${PURPLE}   🔐 Clerk Authentication: Enabled${NC}"
        echo -e "${PURPLE}   🗄️  MongoDB Atlas: Connected${NC}"
    else
        echo -e "${RED}❌ Node.js Backend: Not running${NC}"
    fi
    
    # Check Python backend
    if curl -s http://localhost:5001/docs > /dev/null; then
        echo -e "${GREEN}✅ Python Backend: http://localhost:5001${NC}"
        echo -e "${PURPLE}   🤖 AI Services: Documentation Generation${NC}"
        echo -e "${PURPLE}   📤 OpenAI API: Connected${NC}"
    else
        echo -e "${RED}❌ Python Backend: Not running${NC}"
    fi
    
    # Check React frontend
    if curl -s http://localhost:3000 > /dev/null; then
        echo -e "${GREEN}✅ React Frontend: http://localhost:3000${NC}"
        echo -e "${PURPLE}   🔐 Clerk Authentication: Ready${NC}"
        echo -e "${PURPLE}   📚 Documentation Generator: Enabled${NC}"
    else
        echo -e "${RED}❌ React Frontend: Not running${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}🔗 Quick Links:${NC}"
    echo -e "${BLUE}📱 Frontend:     http://localhost:3000${NC}"
    echo -e "${BLUE}🔐 Auth API:     http://localhost:4001${NC}"
    echo -e "${BLUE}🤖 AI API:       http://localhost:5001${NC}"
    echo -e "${BLUE}📚 API Docs:     http://localhost:5001/docs${NC}"
    echo ""
    echo -e "${PURPLE}🔐 Clerk Dashboard: https://dashboard.clerk.com/${NC}"
    echo -e "${PURPLE}🗄️  MongoDB Atlas:   https://cloud.mongodb.com/${NC}"
    echo ""
    echo -e "${YELLOW}💡 Commands:${NC}"
    echo -e "${YELLOW}   Start:  ./realdoc.sh start${NC}"
    echo -e "${YELLOW}   Stop:   ./realdoc.sh stop${NC}"
    echo -e "${YELLOW}   Status: ./realdoc.sh status${NC}"
    echo -e "${YELLOW}   Logs:   tail -f back/node-backend.log${NC}"
}

# Function to show help/usage
show_help() {
    echo "RealDoc App Management Script"
    echo ""
    echo "Usage: ./realdoc.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start   - Start all RealDoc services (Node.js backend, Python backend, React frontend)"
    echo "  stop    - Stop all RealDoc services"
    echo "  status  - Check the status of all services"
    echo "  help    - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./realdoc.sh start    # Start all services"
    echo "  ./realdoc.sh stop     # Stop all services"
    echo "  ./realdoc.sh status   # Check service status"
    echo ""
    echo "Service Ports:"
    echo "  Frontend:     http://localhost:3000"
    echo "  Node.js API:  http://localhost:4001"
    echo "  Python API:  http://localhost:5001"
    echo "  API Docs:     http://localhost:5001/docs"
    echo ""
}

# Main script logic
case "${1:-}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    status)
        check_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${YELLOW}⚠️  No command specified.${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

