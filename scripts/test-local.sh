#!/bin/bash
set -euo pipefail

# Local Testing Script for RealDoc
# Tests all services and their connections

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
FRONTEND_URL="http://localhost:3000"
NODE_API_URL="http://localhost:4001"
PYTHON_API_URL="http://localhost:5001"

# Counters
PASSED=0
FAILED=0

log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; ((PASSED++)); }
error() { echo -e "${RED}❌ $1${NC}"; ((FAILED++)); }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=${4:-}
    
    if [ "$method" = "GET" ]; then
        if curl -s -f "$url" >/dev/null 2>&1; then
            success "$name: $url"
            return 0
        else
            error "$name: $url (not responding)"
            return 1
        fi
    else
        if curl -s -f -X "$method" -H "Content-Type: application/json" -d "$data" "$url" >/dev/null 2>&1; then
            success "$name: $url"
            return 0
        else
            error "$name: $url (not responding)"
            return 1
        fi
    fi
}

echo "🧪 RealDoc Local Testing Suite"
echo "================================"
echo ""

# Check if services are running
log "Checking if services are running..."

# Test Frontend
log "Testing Frontend..."
if test_endpoint "Frontend" "$FRONTEND_URL"; then
    # Check if it's actually serving React app
    if curl -s "$FRONTEND_URL" | grep -q "react\|root"; then
        success "Frontend is serving React application"
    else
        warning "Frontend is running but may not be serving React app"
    fi
else
    error "Frontend is not running on port 3000"
fi

# Test Node.js Backend
log "Testing Node.js Backend..."
if test_endpoint "Node.js API Health" "$NODE_API_URL/ping"; then
    # Test actual response
    RESPONSE=$(curl -s "$NODE_API_URL/ping")
    if echo "$RESPONSE" | grep -q "ok\|running"; then
        success "Node.js API is responding correctly"
    fi
else
    error "Node.js Backend is not running on port 4001"
fi

# Test Python Backend
log "Testing Python Backend..."
if test_endpoint "Python API Docs" "$PYTHON_API_URL/docs"; then
    success "Python API documentation is accessible"
else
    error "Python Backend is not running on port 5001"
fi

# Test Python API Health
if test_endpoint "Python API Health" "$PYTHON_API_URL/ping"; then
    RESPONSE=$(curl -s "$PYTHON_API_URL/ping")
    if echo "$RESPONSE" | grep -q "ok\|status"; then
        success "Python API is responding correctly"
    fi
else
    warning "Python API /ping endpoint not available (may not be implemented)"
fi

echo ""
log "Testing API Endpoints..."

# Test Documentation API
log "Testing Documentation Generator API..."
DOC_TEST_DATA='{"app_name":"Test App","app_type":"web","doc_type":"user-guide","feature_description":"Test feature","technical_level":"beginner"}'
if curl -s -X POST "$PYTHON_API_URL/api/v1/documentation/" \
    -H "Content-Type: application/json" \
    -d "$DOC_TEST_DATA" \
    --max-time 5 >/dev/null 2>&1; then
    success "Documentation API endpoint is accessible"
else
    error "Documentation API endpoint failed or timed out"
fi

# Test SEO API
log "Testing SEO Generator API..."
SEO_TEST_DATA='{"website_url":"https://example.com","business_type":"saas"}'
if curl -s -X POST "$PYTHON_API_URL/api/v1/seo/" \
    -H "Content-Type: application/json" \
    -d "$SEO_TEST_DATA" \
    --max-time 5 >/dev/null 2>&1; then
    success "SEO API endpoint is accessible"
else
    error "SEO API endpoint failed or timed out"
fi

# Test Analytics API
log "Testing Analytics API..."
ANALYTICS_TEST_DATA='{"website_url":"https://example.com","include_traffic_analysis":true}'
if curl -s -X POST "$PYTHON_API_URL/api/v1/analytics/" \
    -H "Content-Type: application/json" \
    -d "$ANALYTICS_TEST_DATA" \
    --max-time 5 >/dev/null 2>&1; then
    success "Analytics API endpoint is accessible"
else
    error "Analytics API endpoint failed or timed out"
fi

echo ""
log "Testing Service Connections..."

# Test Frontend -> Node.js API connection
log "Testing Frontend to Node.js API connection..."
if curl -s "$NODE_API_URL/api/health" >/dev/null 2>&1; then
    success "Frontend can connect to Node.js API"
else
    error "Frontend cannot connect to Node.js API"
fi

# Test Frontend -> Python API connection (via proxy or direct)
log "Testing Frontend to Python API connection..."
if curl -s "$PYTHON_API_URL/api/v1/documentation/" -X OPTIONS >/dev/null 2>&1; then
    success "Frontend can connect to Python API"
else
    error "Frontend cannot connect to Python API"
fi

# Test Node.js -> Python API proxy (if configured)
log "Testing Node.js to Python API proxy..."
if curl -s "$NODE_API_URL/ai/docs" >/dev/null 2>&1 || curl -s "$NODE_API_URL/ai/ping" >/dev/null 2>&1; then
    success "Node.js can proxy to Python API"
else
    warning "Node.js proxy to Python API not configured or not accessible"
fi

echo ""
log "Checking Environment Configuration..."

# Check for required .env files
if [ -f "back/backend-node/.env" ]; then
    success "Node.js .env file exists"
else
    error "Node.js .env file missing"
fi

if [ -f "back/backend_python/.env" ]; then
    success "Python .env file exists"
else
    error "Python .env file missing"
fi

if [ -f "frontend/.env" ]; then
    success "Frontend .env file exists"
else
    warning "Frontend .env file missing (may use defaults)"
fi

# Check for required environment variables
if [ -f "back/backend-node/.env" ]; then
    if grep -q "MONGODB_URI" back/backend-node/.env; then
        success "MongoDB URI configured"
    else
        error "MongoDB URI not configured"
    fi
    
    if grep -q "CLERK_SECRET_KEY" back/backend-node/.env; then
        success "Clerk authentication configured"
    else
        error "Clerk authentication not configured"
    fi
fi

if [ -f "back/backend_python/.env" ]; then
    if grep -q "OPENAI_API_KEY" back/backend_python/.env; then
        if grep -q "OPENAI_API_KEY=sk-placeholder" back/backend_python/.env; then
            warning "OpenAI API key is placeholder - update with real key"
        else
            success "OpenAI API key configured"
        fi
    else
        error "OpenAI API key not configured"
    fi
fi

echo ""
echo "================================"
echo "📊 Test Results Summary"
echo "================================"
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    success "All tests passed! 🎉"
    exit 0
else
    error "Some tests failed. Please check the errors above."
    exit 1
fi
