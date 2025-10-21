# ReelPostly Sora API Testing Guide

This comprehensive guide covers all testing methods for the ReelPostly Sora API, including both web dashboard and programmatic API access.

## 🔄 Two Separate Credit Systems

**Important**: ReelPostly has two independent video generation systems with separate credit pools:

### **1. Dashboard Credits (Web App)**
- **Location**: `/app/sora` (Sora Videos Dashboard)
- **Database**: MongoDB `User.soraVideoCredits`
- **Backend**: Node.js
- **Usage**: Web interface video generation

### **2. API Credits (Programmatic)**
- **Location**: `https://api.reelpostly.com/video/generate`
- **Database**: DynamoDB `reelpostly-tenants.credits`
- **Backend**: Python FastAPI
- **Usage**: REST API video generation

**Note**: These credit systems are completely separate and do not share balances.

## 🧪 Testing Methods

### Method 1: Frontend Dashboard Testing (Recommended for Users)

1. **Create API Key**:
   - Go to https://reelpostly.com/app/sora-api-dashboard
   - Sign in with your account
   - Click "Create API Key"
   - Copy the generated key (you only see it once!)

2. **Test Video Generation**:
   - Use the dashboard to generate a test video
   - Check that credits are deducted
   - Verify the video is generated and downloadable

### Method 2: API Endpoint Testing (curl/HTTP)

#### Quick Token Validation:
```bash
# Test if your API token is active (recommended method)
curl -X POST "https://api.reelpostly.com/video/generate" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test token validation",
    "model": "sora-2",
    "seconds": 4,
    "size": "720x1280"
  }'
```

**Active Token Response:**
```json
{
  "success": true,
  "video_id": "video_abc123",
  "status": "queued",
  "progress": 0,
  "tenant": "user_xyz",
  "credits_remaining": 9
}
```

**Inactive Token Response:**
```json
{
  "message": "Missing Authentication Token"
}
```

#### Complete API Testing Script:

```bash
#!/bin/bash

# Test Script for Sora API Endpoints
# Tests the complete flow: Authentication → Credit Check → Video Generation

set -e

echo "🧪 Testing Sora API Endpoints..."
echo ""

# Configuration
BASE_URL="https://api.reelpostly.com"
API_KEY="YOUR_API_KEY_HERE"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
if [ -z "$API_KEY" ] || [ "$API_KEY" = "YOUR_API_KEY_HERE" ]; then
    print_status "error" "Please set API_KEY variable with your actual API key"
    echo "You can get an API key from: https://reelpostly.com/app/sora-api-dashboard"
    exit 1
fi

echo "Testing with API Key: ${API_KEY:0:20}..."
echo ""

# Quick token validation
echo "🔑 Validating API token..."
response=$(curl -s -w "%{http_code}" -o /tmp/response.json \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"token validation test","model":"sora-2","seconds":4,"size":"720x1280"}' \
    "$BASE_URL/video/generate")

http_code="${response: -3}"
if [ "$http_code" = "200" ]; then
    print_status "success" "API token is ACTIVE and working"
    echo "Response: $(cat /tmp/response.json)"
else
    print_status "error" "API token validation failed (HTTP $http_code)"
    echo "Response: $(cat /tmp/response.json)"
    echo ""
    echo "Possible issues:"
    echo "- Token is inactive or expired"
    echo "- Token is invalid"
    echo "- API Gateway configuration issue"
    exit 1
fi
echo ""

# Extract credit balance from the video generation response
balance=$(cat /tmp/response.json | grep -o '"credits_remaining":[0-9]*' | cut -d':' -f2)
video_id=$(cat /tmp/response.json | grep -o '"video_id":"[^"]*"' | cut -d'"' -f4)
echo "Available credits: $balance"
echo "Generated video ID: $video_id"
echo ""

# Test 3: Check video status
echo "3️⃣ Testing video status check..."
response=$(curl -s -w "%{http_code}" -o /tmp/response.json \
    -H "x-api-key: $API_KEY" \
    "$BASE_URL/video/status/$video_id")

http_code="${response: -3}"
if [ "$http_code" = "200" ]; then
    print_status "success" "Video status retrieved"
    echo "Response: $(cat /tmp/response.json)"
else
    print_status "error" "Video status check failed (HTTP $http_code)"
    echo "Response: $(cat /tmp/response.json)"
fi
echo ""

# Test 4: Generate another video to test credit deduction
if [ "$balance" -gt 0 ]; then
    echo "4️⃣ Testing another video generation (credit deduction test)..."
    print_status "info" "Generating another test video to verify credit deduction"
    
    # Create a test video generation request
    cat > /tmp/video_request2.json << EOF
{
    "prompt": "A beautiful sunset over mountains",
    "model": "sora-2",
    "seconds": 8,
    "size": "1280x720"
}
EOF
    
    response=$(curl -s -w "%{http_code}" -o /tmp/response2.json \
        -H "x-api-key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d @/tmp/video_request2.json \
        "$BASE_URL/video/generate")
    
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        print_status "success" "Second video generation successful"
        echo "Response: $(cat /tmp/response2.json)"
        
        # Extract new credit balance
        new_balance=$(cat /tmp/response2.json | grep -o '"credits_remaining":[0-9]*' | cut -d':' -f2)
        echo "New credit balance: $new_balance (was: $balance)"
        
        if [ "$new_balance" -lt "$balance" ]; then
            print_status "success" "Credit deduction working correctly"
        else
            print_status "error" "Credit deduction may not be working"
        fi
    else
        print_status "error" "Second video generation failed (HTTP $http_code)"
        echo "Response: $(cat /tmp/response2.json)"
    fi
else
    print_status "info" "Skipping second video generation test - no credits available"
fi

echo ""
echo "🎉 API testing complete!"
```

### Method 3: Backend Infrastructure Testing

For developers testing the backend infrastructure:

```bash
# Test AWS connections and API key creation
node test-api-flow.js
```

This tests:
- ✅ DynamoDB connection
- ✅ API Gateway connection  
- ✅ OpenAI API key configuration
- ✅ API key creation and association
- ✅ Credit management
- ✅ Data cleanup

## 🔍 Manual Testing Steps

### Step 1: Check API Token Status

**Quick Token Validation:**
```bash
# Test if your API token is active (recommended method)
curl -X POST "https://api.reelpostly.com/video/generate" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test token validation",
    "model": "sora-2",
    "seconds": 4,
    "size": "720x1280"
  }'
```

**Active Token Response:**
```json
{
  "success": true,
  "video_id": "video_abc123",
  "status": "queued",
  "progress": 0,
  "tenant": "user_xyz",
  "credits_remaining": 9
}
```

**Inactive Token Response:**
```json
{
  "message": "Missing Authentication Token"
}
```

### Step 2: Verify Infrastructure

```bash
# Check if DynamoDB table exists
aws dynamodb describe-table --table-name reelpostly-tenants --region us-west-2

# Check if API Gateway is configured
aws apigateway get-rest-apis --region us-west-2
```

### Step 3: Test Credit System

1. **Create API Key** via dashboard
2. **Check Initial Credits**: Should have 10 free credits
3. **Generate Video**: Should deduct 1 credit for sora-2
4. **Verify Balance**: Should show 9 credits remaining

### Step 4: Test Video Generation

```bash
# Test with curl (replace YOUR_API_KEY)
curl -X POST "https://api.reelpostly.com/video/generate" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over the ocean",
    "model": "sora-2",
    "seconds": 4,
    "size": "720x1280"
  }'
```

### Step 5: Monitor Credit Deduction

```bash
# Check video status and get download URL when ready
curl -X GET "https://api.reelpostly.com/video/status/video_abc123" \
  -H "x-api-key: YOUR_API_KEY"
```

## 📊 Expected Responses

### Video Generation Response:
```json
{
  "success": true,
  "video_id": "video_68f6e029a36881909434ec9239d4f660084f545056ccd997",
  "status": "queued",
  "progress": 0,
  "tenant": "user_34Lw8G9nNVQa2TtWihQGPAX9GWs",
  "credits_remaining": 9
}
```

### Video Status Response (Processing):
```json
{
  "success": true,
  "id": "video_abc123",
  "status": "processing",
  "progress": 45,
  "providerStatus": "in_progress"
}
```

### Video Status Response (Completed):
```json
{
  "success": true,
  "id": "video_abc123",
  "status": "completed",
  "progress": 100,
  "providerStatus": "completed",
  "url": "https://bigvideograb-media.s3.amazonaws.com/sora-api-videos/12345-video_abc123.mp4?X-Amz-Signature=...",
  "filename": "video_abc123.mp4",
  "size": 1234567
}
```

## 🚨 Troubleshooting

### Common Issues:

1. **"Missing Authentication Token"**
   - Check API key format: `x-api-key: YOUR_KEY`
   - Verify key is active in API Gateway
   - Ensure correct endpoint: `/video/generate`

2. **"Invalid API key"**
   - Key may be expired or disabled
   - Check DynamoDB for key status
   - Verify key is associated with usage plan

3. **"Not Found" errors**
   - Use correct endpoint: `/video/generate` (not `/ai/api/v1/videos/credits`)
   - Check API Gateway deployment status

4. **Credit deduction not working**
   - Verify DynamoDB connection
   - Check AWS permissions
   - Ensure key is properly linked to tenant

## 📝 Notes

- API keys are shown only once during creation
- Videos are stored in S3 with 7-day expiry
- Credits are tracked per API key in DynamoDB
- Dashboard and API credits are completely separate systems
