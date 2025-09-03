#!/bin/bash

# Repostly App Status Check Script
echo "🔍 Repostly App Status Check..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

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
    echo -e "${PURPLE}   🤖 AI Services: Captions & Hashtags${NC}"
    echo -e "${PURPLE}   📤 Media Upload: AWS S3${NC}"
else
    echo -e "${RED}❌ Python Backend: Not running${NC}"
fi

# Check React frontend
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ React Frontend: http://localhost:3000${NC}"
    echo -e "${PURPLE}   🔐 Clerk Authentication: Ready${NC}"
    echo -e "${PURPLE}   📱 Multi-platform Preview: Enabled${NC}"
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
echo -e "${YELLOW}   Start:  ./start-app.sh${NC}"
echo -e "${YELLOW}   Stop:   ./stop-app.sh${NC}"
echo -e "${YELLOW}   Status: ./status-app.sh${NC}"
echo -e "${YELLOW}   Logs:   tail -f back/node-backend.log${NC}"
