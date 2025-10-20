# Sora API Flow Testing Guide

This guide shows you how to test the complete API key flow from authentication to video generation.

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

### Method 2: Backend Infrastructure Testing

Run the comprehensive backend test:

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

### Method 3: API Endpoint Testing

Test the actual API endpoints:

```bash
# First, update the API_KEY variable in the script
# Edit test-api-endpoints.sh and replace API_KEY=""

# Then run the test
bash test-api-endpoints.sh
```

This tests:
- ✅ API key validation
- ✅ Credit balance checking
- ✅ Pricing information
- ✅ Video generation
- ✅ Credit deduction

## 🔍 Manual Testing Steps

### Step 1: Verify Infrastructure

```bash
# Check if DynamoDB table exists
aws dynamodb describe-table --table-name reelpostly-tenants --region us-west-2

# Check if API Gateway is configured
aws apigateway get-rest-apis --region us-west-2
```

### Step 2: Test Credit System

1. **Create API Key** via dashboard
2. **Check Initial Credits**: Should have 10 free credits
3. **Generate Video**: Should deduct 1 credit for sora-2
4. **Verify Balance**: Should show 9 credits remaining

### Step 3: Test Video Generation

```bash
# Test with curl (replace YOUR_API_KEY)
curl -X POST "https://api.reelpostly.com/v1/video/generate" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cat playing with a ball",
    "model": "sora-2", 
    "seconds": 4,
    "size": "720x1280"
  }'
```

### Step 4: Monitor Credit Deduction

```bash
# Check credit balance before
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.reelpostly.com/v1/credits/balance"

# Generate video (see above)

# Check credit balance after
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.reelpostly.com/v1/credits/balance"
```

## 🐛 Troubleshooting

### Common Issues

1. **"API key not found"**:
   - Verify API key is correctly copied
   - Check if API key exists in DynamoDB

2. **"Insufficient credits"**:
   - Check credit balance in DynamoDB
   - Verify credit deduction logic

3. **"OpenAI API error"**:
   - Check OPENAI_API_KEY environment variable
   - Verify OpenAI API key is valid and has credits

4. **"DynamoDB connection failed"**:
   - Check AWS credentials and permissions
   - Verify table exists in us-west-2 region

### Debug Commands

```bash
# Check DynamoDB table contents
aws dynamodb scan --table-name reelpostly-tenants --region us-west-2

# Check API Gateway usage plans
aws apigateway get-usage-plans --region us-west-2

# Check environment variables
echo $OPENAI_API_KEY
echo $AWS_REGION
```

## 📊 Expected Flow

```
1. User creates API key → Stored in DynamoDB + API Gateway
2. User makes API call → AWS API Gateway validates key
3. Backend checks credits → DynamoDB query
4. Credits sufficient? → Deduct credits from DynamoDB
5. Call OpenAI API → Using shared OpenAI key
6. OpenAI processes → Returns video URL
7. Backend uploads to S3 → Returns presigned URL
8. User receives video → Credits deducted successfully
```

## ✅ Success Criteria

- [ ] API key creation works
- [ ] API key validation works
- [ ] Credit balance tracking works
- [ ] Credit deduction works
- [ ] Video generation works
- [ ] OpenAI API integration works
- [ ] S3 upload works
- [ ] Error handling works
- [ ] Rate limiting works

## 🔧 Environment Setup

Make sure these environment variables are set:

```bash
# AWS Configuration
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# OpenAI Configuration  
OPENAI_API_KEY=your_openai_key

# Application Configuration
NODE_ENV=production
APP_URL=https://reelpostly.com
```

## 📝 Test Results Template

```
Test Date: ___________
API Key: ___________
Initial Credits: ___________
Final Credits: ___________
Video Generated: [ ] Yes [ ] No
Video URL: ___________
Errors: ___________
Notes: ___________
```
