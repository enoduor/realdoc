# SSM Parameter Troubleshooting Guide

## Problem: AI Services Not Working (OpenAI API Key Issues)

### Symptoms
- AI caption generation fails
- AI hashtag generation fails
- OpenAI API authentication errors
- Services return fallback responses instead of AI-generated content

### Root Cause
The deployed application uses SSM Parameter Store for environment variables, but the OpenAI API key in SSM is expired/invalid.

---

## Step-by-Step Troubleshooting Process

### Step 1: Identify the Issue
```bash
# Test AI service health
curl -s https://reelpostly.com/ai/ping

# Test caption generation (should return AI-generated content, not fallback)
curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "test", "platform": "instagram", "tone": "professional"}' | jq .
```

**Expected**: AI-generated captions
**Problem**: Fallback responses like "Check out this amazing content about test! 🔥"

### Step 2: Check Current SSM Parameters
```bash
# List all repostly SSM parameters
aws ssm get-parameters-by-path \
  --path "/repostly" \
  --recursive \
  --query 'Parameters[*].[Name,Value]' \
  --output table

# Check specific OpenAI parameter
aws ssm get-parameter \
  --name "/repostly/ai/OPENAI_API_KEY" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text
```

### Step 3: Update SSM Parameter
```bash
# Update OpenAI API key in SSM
aws ssm put-parameter \
  --name "/repostly/ai/OPENAI_API_KEY" \
  --value "your-new-openai-api-key" \
  --type "SecureString" \
  --overwrite

# Verify update
aws ssm get-parameter \
  --name "/repostly/ai/OPENAI_API_KEY" \
  --query 'Parameter.Version' \
  --output text
```

### Step 4: Redeploy Application
```bash
# Deploy with updated SSM parameters
AWS_ACCOUNT_ID=657053005765 AWS_REGION=us-west-2 ./scripts/deploy-single-container.sh
```

### Step 5: Verify Fix
```bash
# Test AI service after deployment
curl -s https://reelpostly.com/ai/ping

# Test caption generation
curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "deployment test", "platform": "instagram", "tone": "professional"}' | jq .

# Test hashtag generation
curl -s -X POST https://reelpostly.com/ai/api/v1/hashtags/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "deployment test", "platform": "instagram", "count": 5}' | jq .
```

---

## SSM Parameters Reference

### Current SSM Parameter Paths
```
/repostly/api/MONGODB_URI
/repostly/api/CLERK_SECRET_KEY
/repostly/api/CLERK_PUBLISHABLE_KEY
/repostly/api/CLERK_ISSUER_URL
/repostly/ai/OPENAI_API_KEY                    # ← Most commonly needs updates
/repostly/api/STRIPE_SECRET_KEY
/repostly/api/STRIPE_WEBHOOK_SECRET
/repostly/api/STRIPE_STARTER_MONTHLY_PRICE_ID
/repostly/api/STRIPE_STARTER_YEARLY_PRICE_ID
/repostly/api/STRIPE_CREATOR_MONTHLY_PRICE_ID
/repostly/api/STRIPE_CREATOR_YEARLY_PRICE_ID
/repostly/api/STRIPE_PRO_MONTHLY_PRICE_ID
/repostly/api/STRIPE_PRO_YEARLY_PRICE_ID
/repostly/api/FRONTEND_URL
/repostly/api/APP_URL
/repostly/api/FACEBOOK_APP_ID
/repostly/api/FACEBOOK_APP_SECRET
/repostly/api/FACEBOOK_REDIRECT_URI
```

### Update Any SSM Parameter
```bash
aws ssm put-parameter \
  --name "/repostly/[service]/[PARAMETER_NAME]" \
  --value "new-value" \
  --type "SecureString" \
  --overwrite
```

---

## Complete Testing Suite

### Frontend Tests
```bash
# Test main page loads
curl -s https://reelpostly.com/ | head -20

# Test static assets
curl -s -I https://reelpostly.com/static/js/main.541928bc.js

# Test CSS loads
curl -s -I https://reelpostly.com/static/css/main.db1b6340.css

# Test favicon
curl -s -I https://reelpostly.com/favicon.ico
```

### Backend API Tests
```bash
# Test Node.js API health (if available)
curl -s https://reelpostly.com/api/health

# Test API endpoints (if available)
curl -s https://reelpostly.com/api/status
```

### AI Service Tests
```bash
# Test AI service health
curl -s https://reelpostly.com/ai/ping

# Test AI service docs
curl -s https://reelpostly.com/ai/docs

# Test caption generation - Instagram
curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "deployment test", "platform": "instagram", "tone": "professional"}' | jq .

# Test caption generation - TikTok
curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "deployment test", "platform": "tiktok", "tone": "casual"}' | jq .

# Test caption generation - LinkedIn
curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "deployment test", "platform": "linkedin", "tone": "professional"}' | jq .

# Test caption generation - Twitter
curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "deployment test", "platform": "twitter", "tone": "casual"}' | jq .

# Test hashtag generation - Instagram
curl -s -X POST https://reelpostly.com/ai/api/v1/hashtags/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "deployment test", "platform": "instagram", "count": 5}' | jq .

# Test hashtag generation - TikTok
curl -s -X POST https://reelpostly.com/ai/api/v1/hashtags/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "deployment test", "platform": "tiktok", "count": 3}' | jq .

# Test hashtag generation - LinkedIn
curl -s -X POST https://reelpostly.com/ai/api/v1/hashtags/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "deployment test", "platform": "linkedin", "count": 4}' | jq .
```

### Media Upload Tests
```bash
# Test media upload endpoint (if available)
curl -s -X POST https://reelpostly.com/ai/api/v1/upload \
  -F "file=@test-image.jpg" \
  -H "Content-Type: multipart/form-data" | jq .
```

### Error Handling Tests
```bash
# Test invalid platform
curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "test", "platform": "invalid", "tone": "professional"}' | jq .

# Test missing parameters
curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "test"}' | jq .

# Test invalid JSON
curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d 'invalid json' | jq .
```

### Performance Tests
```bash
# Test response time for caption generation
time curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "performance test", "platform": "instagram", "tone": "professional"}' > /dev/null

# Test response time for hashtag generation
time curl -s -X POST https://reelpostly.com/ai/api/v1/hashtags/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "performance test", "platform": "instagram", "count": 5}' > /dev/null
```

### SSL/HTTPS Tests
```bash
# Test SSL certificate
curl -s -I https://reelpostly.com/ | grep -i "server\|date\|content-type"

# Test HTTPS redirect (if applicable)
curl -s -I http://reelpostly.com/ | grep -i "location\|301\|302"
```

### CORS Tests
```bash
# Test CORS headers
curl -s -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS https://reelpostly.com/ai/api/v1/captions/ | jq .
```

---

## Quick Commands Reference

### Essential Health Checks
```bash
# Frontend
curl -s https://reelpostly.com/ | head -20

# AI Service Health
curl -s https://reelpostly.com/ai/ping

# Basic Caption Generation Test
curl -s -X POST https://reelpostly.com/ai/api/v1/captions/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "test", "platform": "instagram", "tone": "professional"}' | jq .

# Basic Hashtag Generation Test
curl -s -X POST https://reelpostly.com/ai/api/v1/hashtags/ \
  -H "Content-Type: application/json" \
  -d '{"topic": "test", "platform": "instagram", "count": 5}' | jq .
```

### Deploy Application
```bash
AWS_ACCOUNT_ID=657053005765 AWS_REGION=us-west-2 ./scripts/deploy-single-container.sh
```

---

## Automated Test Script

Create a test script to run all tests automatically:

```bash
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
```

### Run the Test Script
```bash
# Make script executable
chmod +x test-repostly.sh

# Run all tests
./test-repostly.sh

# Run specific test categories
./test-repostly.sh | grep "Frontend Tests" -A 20
./test-repostly.sh | grep "AI Service Tests" -A 10
./test-repostly.sh | grep "Caption Generation Tests" -A 15
```

---

## Prevention Tips

1. **Monitor OpenAI API Usage**: Check OpenAI dashboard for quota/usage limits
2. **Set Up Alerts**: Monitor application logs for OpenAI authentication errors
3. **Regular Key Rotation**: Update API keys before they expire
4. **Test After Updates**: Always test AI services after SSM parameter updates

---

## Common Error Messages

- `"OpenAI API quota exceeded"` → Update OpenAI API key in SSM
- `"Rate limit exceeded"` → Wait or check API usage limits
- `"Authentication failed"` → Invalid API key in SSM
- `"AI service running"` but fallback responses → SSM parameter issue

---

**Last Updated**: January 12, 2025
**Issue Resolved**: OpenAI API key updated in SSM Parameter Store
