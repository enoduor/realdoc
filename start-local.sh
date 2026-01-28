#!/bin/bash
set -euo pipefail

# Local Development Startup Script for RealDoc
# Starts all services for local testing

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        log "Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
        sleep 2
    fi
}

# Check environment files
check_env_files() {
    local missing=0
    
    if [ ! -f "back/backend-node/.env" ]; then
        error "Missing: back/backend-node/.env"
        missing=1
    fi
    
    if [ ! -f "back/backend_python/.env" ]; then
        error "Missing: back/backend_python/.env"
        missing=1
    fi
    
    if [ ! -f "frontend/.env" ]; then
        warning "Missing: frontend/.env (optional, but recommended)"
    fi
    
    return $missing
}

# Start services
start_services() {
    echo ""
    log "🚀 Starting RealDoc Services Locally..."
    echo ""
    
    # Check environment files
    if ! check_env_files; then
        error "Environment files are missing. Please create the required .env files."
        exit 1
    fi
    
    # Kill existing processes on ports
    log "Checking for existing processes..."
    kill_port 3000  # Frontend
    kill_port 4001  # Node.js backend
    kill_port 5001  # Python backend
    sleep 2
    
    # Check port availability
    log "Checking port availability..."
    if ! check_port 3000; then
        error "Port 3000 is already in use"
        exit 1
    fi
    if ! check_port 4001; then
        error "Port 4001 is already in use"
        exit 1
    fi
    if ! check_port 5001; then
        error "Port 5001 is already in use"
        exit 1
    fi
    
    # Start Node.js Backend
    log "Starting Node.js Backend (Port 4001)..."
    cd back/backend-node
    if [ ! -d "node_modules" ]; then
        log "Installing Node.js dependencies..."
        npm install
    fi
    npm start > ../../node-backend.log 2>&1 &
    NODE_PID=$!
    echo $NODE_PID > ../../.node-pid
    success "Node.js Backend started (PID: $NODE_PID)"
    cd ../..
    
    # Start Python Backend
    log "Starting Python Backend (Port 5001)..."
    cd back/backend_python
    if [ ! -d "venv" ]; then
        log "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    source venv/bin/activate
    if [ ! -f "venv/bin/activate" ] || ! python -c "import fastapi" 2>/dev/null; then
        log "Installing Python dependencies..."
        pip install -q -r requirements.txt
    fi
    python3 -m uvicorn main:app --host 0.0.0.0 --port 5001 --reload > ../../python-backend.log 2>&1 &
    PYTHON_PID=$!
    echo $PYTHON_PID > ../../.python-pid
    success "Python Backend started (PID: $PYTHON_PID)"
    cd ../..
    
    # Start React Frontend
    log "Starting React Frontend (Port 3000)..."
    cd frontend
    if [ ! -d "node_modules" ]; then
        log "Installing Frontend dependencies..."
        npm install
    fi
    npm start > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../.frontend-pid
    success "React Frontend started (PID: $FRONTEND_PID)"
    cd ..
    
    # Wait for services to start
    log "Waiting for services to initialize..."
    sleep 8
    
    # Check service status
    echo ""
    log "Checking service status..."
    echo ""
    
    if curl -s http://localhost:4001/health >/dev/null 2>&1 || curl -s http://localhost:4001 >/dev/null 2>&1; then
        success "Node.js Backend: http://localhost:4001"
    else
        warning "Node.js Backend: Starting... (check logs: tail -f node-backend.log)"
    fi
    
    if curl -s http://localhost:5001/docs >/dev/null 2>&1; then
        success "Python Backend: http://localhost:5001 (API Docs: http://localhost:5001/docs)"
    else
        warning "Python Backend: Starting... (check logs: tail -f python-backend.log)"
    fi
    
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        success "React Frontend: http://localhost:3000"
    else
        warning "React Frontend: Starting... (check logs: tail -f frontend.log)"
    fi
    
    echo ""
    success "🎉 All services are starting!"
    echo ""
    echo -e "${BLUE}📱 Frontend:     http://localhost:3000${NC}"
    echo -e "${BLUE}🔐 Node API:     http://localhost:4001${NC}"
    echo -e "${BLUE}🤖 Python API:   http://localhost:5001${NC}"
    echo -e "${BLUE}📚 API Docs:     http://localhost:5001/docs${NC}"
    echo ""
    echo -e "${YELLOW}💡 To stop services, run: ./stop-local.sh${NC}"
    echo -e "${YELLOW}📋 To view logs: tail -f node-backend.log python-backend.log frontend.log${NC}"
    echo ""
}

# Stop services
stop_services() {
    log "Stopping RealDoc services..."
    
    if [ -f ".node-pid" ]; then
        NODE_PID=$(cat .node-pid)
        if ps -p $NODE_PID > /dev/null 2>&1; then
            kill $NODE_PID 2>/dev/null || true
            success "Stopped Node.js Backend"
        fi
        rm -f .node-pid
    fi
    
    if [ -f ".python-pid" ]; then
        PYTHON_PID=$(cat .python-pid)
        if ps -p $PYTHON_PID > /dev/null 2>&1; then
            kill $PYTHON_PID 2>/dev/null || true
            success "Stopped Python Backend"
        fi
        rm -f .python-pid
    fi
    
    if [ -f ".frontend-pid" ]; then
        FRONTEND_PID=$(cat .frontend-pid)
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            kill $FRONTEND_PID 2>/dev/null || true
            success "Stopped React Frontend"
        fi
        rm -f .frontend-pid
    fi
    
    # Also kill by port as backup
    kill_port 3000
    kill_port 4001
    kill_port 5001
    
    success "All services stopped"
}

# Main
case "${1:-start}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        start_services
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac
