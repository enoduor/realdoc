#!/bin/bash

# Simple API Test Script
set -e

echo "🧪 Testing Sora API with Authentication..."

# Configuration
BASE_URL="https://api.reelpostly.com"
API_KEY="Gozig86nDA6d9rcyaslad9QAFZrVKwts3XuYaGzR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Testing with API Key: ${API_KEY:0:20}..."
echo ""

# Test 1: Check credits (this validates the API key)
echo "1️⃣ Testing API key validation and credit balance..."
response=$(curl -s -w "%{http_code}" -o /tmp/response.json \
    -H "X-API-Key: $API_KEY" \
    "$BASE_URL/ai/api/v1/video/credits")

http_code="${response: -3}"
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ API key is valid${NC}"
    echo "Response: $(cat /tmp/response.json)"
    
    # Extract credit balance
    balance=$(cat /tmp/response.json | grep -o '"credits":[0-9]*' | cut -d':' -f2)
    echo "Available credits: $balance"
else
    echo -e "${RED}❌ API key validation failed (HTTP $http_code)${NC}"
    echo "Response: $(cat /tmp/response.json)"
    exit 1
fi
echo ""

# Test 2: Test video generation (if credits available)
if [ "$balance" -gt 0 ]; then
    echo "2️⃣ Testing video generation..."
    echo -e "${YELLOW}ℹ️  Attempting to generate a test video (this will consume 1 credit)${NC}"
    
    # Create test request
    cat > /tmp/video_request.json << EOF
{
    "prompt": "A cute cat playing with a ball",
    "model": "sora-2",
    "seconds": 4,
    "size": "720x1280"
}
EOF

    response=$(curl -s -w "%{http_code}" -o /tmp/response.json \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d @/tmp/video_request.json \
        "$BASE_URL/ai/api/v1/video/generate-video")

    http_code="${response: -3}"
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✅ Video generation request submitted${NC}"
        echo "Response: $(cat /tmp/response.json)"
    else
        echo -e "${RED}❌ Video generation failed (HTTP $http_code)${NC}"
        echo "Response: $(cat /tmp/response.json)"
    fi
else
    echo -e "${YELLOW}ℹ️  Skipping video generation test - no credits available${NC}"
fi

# Cleanup
rm -f /tmp/response.json /tmp/video_request.json

echo ""
echo "🎉 API test completed!"
