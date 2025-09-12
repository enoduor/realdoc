#!/bin/bash
# test-repostly.sh - Comprehensive Repostly Application Test Suite

set -euo pipefail

BASE_URL="https://reelpostly.com"
AI_URL="${BASE_URL}/ai"

echo "🧪 Starting Repostly Application Test Suite"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        return 1
    fi
}

echo -e "\n${BLUE}🌐 Frontend Tests${NC}"
curl -s "${BASE_URL}/" | head -20 > /dev/null
test_result $? "Frontend loads"

curl -s -I "${BASE_URL}/static/js/main.541928bc.js" | grep -q "200 OK"
test_result $? "JavaScript assets load"

curl -s -I "${BASE_URL}/static/css/main.db1b6340.css" | grep -q "200 OK"
test_result $? "CSS assets load"

echo -e "\n${BLUE}🤖 AI Service Tests${NC}"
curl -s "${AI_URL}/ping" | grep -q "AI service running"
test_result $? "AI service health check"

echo -e "\n${BLUE}📝 Caption Generation Tests${NC}"
# Test Instagram captions
response=$(curl -s -X POST "${AI_URL}/api/v1/captions/" \
  -H "Content-Type: application/json" \
  -d '{"topic": "automated test", "platform": "instagram", "tone": "professional"}')
echo "$response" | jq -e '.caption' > /dev/null
test_result $? "Instagram caption generation"

# Test TikTok captions
response=$(curl -s -X POST "${AI_URL}/api/v1/captions/" \
  -H "Content-Type: application/json" \
  -d '{"topic": "automated test", "platform": "tiktok", "tone": "casual"}')
echo "$response" | jq -e '.caption' > /dev/null
test_result $? "TikTok caption generation"

# Test LinkedIn captions
response=$(curl -s -X POST "${AI_URL}/api/v1/captions/" \
  -H "Content-Type: application/json" \
  -d '{"topic": "automated test", "platform": "linkedin", "tone": "professional"}')
echo "$response" | jq -e '.caption' > /dev/null
test_result $? "LinkedIn caption generation"

echo -e "\n${BLUE}🏷️  Hashtag Generation Tests${NC}"
# Test Instagram hashtags
response=$(curl -s -X POST "${AI_URL}/api/v1/hashtags/" \
  -H "Content-Type: application/json" \
  -d '{"topic": "automated test", "platform": "instagram", "count": 5}')
echo "$response" | jq -e '.hashtags' > /dev/null
test_result $? "Instagram hashtag generation"

# Test TikTok hashtags
response=$(curl -s -X POST "${AI_URL}/api/v1/hashtags/" \
  -H "Content-Type: application/json" \
  -d '{"topic": "automated test", "platform": "tiktok", "count": 3}')
echo "$response" | jq -e '.hashtags' > /dev/null
test_result $? "TikTok hashtag generation"

echo -e "\n${BLUE}⚡ Performance Tests${NC}"
start_time=$(date +%s%N)
curl -s -X POST "${AI_URL}/api/v1/captions/" \
  -H "Content-Type: application/json" \
  -d '{"topic": "performance test", "platform": "instagram", "tone": "professional"}' > /dev/null
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))
if [ $duration -lt 5000 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Caption generation performance (${duration}ms)"
else
    echo -e "${YELLOW}⚠️  SLOW${NC}: Caption generation performance (${duration}ms)"
fi

echo -e "\n${BLUE}🔒 Security Tests${NC}"
curl -s -I "${BASE_URL}" | grep -q "HTTPS"
test_result $? "HTTPS enabled"

echo -e "\n${BLUE}🚫 Error Handling Tests${NC}"
# Test invalid platform
response=$(curl -s -X POST "${AI_URL}/api/v1/captions/" \
  -H "Content-Type: application/json" \
  -d '{"topic": "test", "platform": "invalid", "tone": "professional"}')
echo "$response" | jq -e '.caption' > /dev/null
test_result $? "Invalid platform handling"

echo -e "\n${GREEN}🎉 Test Suite Complete!${NC}"
echo "=========================================="
