#!/bin/bash

# Test Script for Sora API Endpoints
# Tests the complete flow: Authentication → Credit Check → Video Generation

set -e

echo "🧪 Testing Sora API Endpoints..."
echo ""

# Configuration
BASE_URL="https://api.reelpostly.com"
API_KEY="Gozig86nDA6d9rcyaslad9QAFZrVKwts3XuYaGzR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "success" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "error" ]; then
        echo -e "${RED}❌ $message${NC}"
    elif [ "$status" = "info" ]; then
        echo -e "${YELLOW}ℹ️  $message${NC}"
    fi
}

# Check if API key is provided
if [ -z "$API_KEY" ]; then
    print_status "error" "Please set API_KEY variable with your actual API key"
    echo "You can get an API key from: https://reelpostly.com/app/sora-api-dashboard"
    exit 1
fi

echo "Testing with API Key: ${API_KEY:0:20}..."
echo ""

# Test 1: Check API key status
echo "1️⃣ Testing API key validation..."
response=$(curl -s -w "%{http_code}" -o /tmp/response.json \
    -H "X-API-Key: $API_KEY" \
    "$BASE_URL/ai/api/v1/video/credits")

http_code="${response: -3}"
if [ "$http_code" = "200" ]; then
    print_status "success" "API key is valid"
    echo "Response: $(cat /tmp/response.json)"
else
    print_status "error" "API key validation failed (HTTP $http_code)"
    echo "Response: $(cat /tmp/response.json)"
    exit 1
fi
echo ""

# Extract credit balance from the validation response
balance=$(cat /tmp/response.json | grep -o '"credits":[0-9]*' | cut -d':' -f2)
echo "Available credits: $balance"
echo ""

# Test 3: Get pricing information
echo "3️⃣ Testing pricing information..."
response=$(curl -s -w "%{http_code}" -o /tmp/response.json \
    -H "Authorization: Bearer $API_KEY" \
    "$BASE_URL/v1/pricing")

http_code="${response: -3}"
if [ "$http_code" = "200" ]; then
    print_status "success" "Pricing information retrieved"
    echo "Response: $(cat /tmp/response.json)"
else
    print_status "error" "Pricing check failed (HTTP $http_code)"
    echo "Response: $(cat /tmp/response.json)"
fi
echo ""

# Test 4: Test video generation (if credits available)
if [ "$balance" -gt 0 ]; then
    echo "4️⃣ Testing video generation..."
    print_status "info" "Attempting to generate a test video (this will consume 1 credit)"
    
    # Create a test video generation request
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
        print_status "success" "Video generation request submitted"
        echo "Response: $(cat /tmp/response.json)"
        
        # Check if we got a video ID
        video_id=$(cat /tmp/response.json | grep -o '"video_id":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$video_id" ]; then
            print_status "success" "Video ID: $video_id"
        fi
    else
        print_status "error" "Video generation failed (HTTP $http_code)"
        echo "Response: $(cat /tmp/response.json)"
    fi
else
    print_status "info" "Skipping video generation test - no credits available"
fi
echo ""

# Test 5: Check final credit balance
echo "5️⃣ Checking final credit balance..."
response=$(curl -s -w "%{http_code}" -o /tmp/response.json \
    -H "Authorization: Bearer $API_KEY" \
    "$BASE_URL/v1/credits/balance")

http_code="${response: -3}"
if [ "$http_code" = "200" ]; then
    print_status "success" "Final credit balance retrieved"
    final_balance=$(cat /tmp/response.json | grep -o '"credits":[0-9]*' | cut -d':' -f2)
    echo "Final credits: $final_balance"
    
    if [ "$balance" -gt "$final_balance" ]; then
        print_status "success" "Credits were deducted successfully"
    else
        print_status "info" "No credits were deducted (video generation may have failed or been skipped)"
    fi
else
    print_status "error" "Final credit balance check failed (HTTP $http_code)"
fi
echo ""

# Cleanup
rm -f /tmp/response.json /tmp/video_request.json

echo "🎉 API endpoint testing completed!"
echo ""
echo "📋 Summary:"
echo "   ✅ API key validation"
echo "   ✅ Credit balance checking"
echo "   ✅ Pricing information"
echo "   ✅ Video generation (if credits available)"
echo "   ✅ Credit deduction verification"
echo ""
echo "💡 To test with your own API key:"
echo "   1. Go to https://reelpostly.com/app/sora-api-dashboard"
echo "   2. Create an API key"
echo "   3. Update the API_KEY variable in this script"
echo "   4. Run: bash test-api-endpoints.sh"
