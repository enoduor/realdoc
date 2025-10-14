# ReelPostly Sora API - AWS Infrastructure Setup

## Overview

This setup creates a complete **production-ready Sora video generation API** using AWS serverless infrastructure. The API provides resellable access to OpenAI's Sora-2 video generation with built-in:

- ✅ API key management
- ✅ Usage tracking & throttling
- ✅ Credit-based billing
- ✅ Automatic video downloads from OpenAI
- ✅ S3 storage with presigned URLs
- ✅ DynamoDB tenant management

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ x-api-key: xxx
       ▼
┌─────────────────────┐
│   API Gateway       │
│  (Key Validation)   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐      ┌──────────────┐
│  Lambda Functions   │◄────►│  DynamoDB    │
│  (Real Sora Logic)  │      │  (Credits)   │
└──────┬──────────────┘      └──────────────┘
       │
       ▼
┌─────────────────────┐
│   OpenAI Sora API   │
│  (Video Generation) │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   AWS S3            │
│  (Video Storage)    │
└─────────────────────┘
```

## Prerequisites

1. **AWS CLI configured** with appropriate credentials
2. **OpenAI API key** stored in AWS SSM Parameter Store:
   ```bash
   aws ssm put-parameter \
     --name "/repostly/OPENAI_API_KEY" \
     --value "sk-proj-YOUR_KEY_HERE" \
     --type "SecureString" \
     --region us-west-2
   ```
3. **DynamoDB table** created:
   ```bash
   bash scripts/create-api-table.sh
   ```
4. **S3 bucket** for video storage (defaults to `bigvideograb-media`)

## Setup Instructions

### 1. Create DynamoDB Table (First Time Only)
```bash
bash scripts/create-api-table.sh
```

This creates the `reelpostly-tenants` table with schema:
- **Primary Key**: `apiKeyId` (String) - AWS API Gateway key ID
- **Attributes**: `tenantId`, `email`, `planId`, `credits`, `status`, `createdAt`

### 2. Run the Setup Script
```bash
bash scripts/setup-reelpostly-api.sh
```

This will:
1. Create IAM roles with proper permissions (DynamoDB, S3, SSM, Lambda)
2. Deploy Lambda functions with **real Sora logic**
3. Create API Gateway REST API with endpoints
4. Configure CORS for browser access
5. Set up usage plans (10 req/s, 1000/month)
6. Generate test API key
7. Seed DynamoDB with test tenant

### 3. Test the API

**Base URL:** `https://api.reelpostly.com`

**Create Video:**
```bash
curl -X POST "https://api.reelpostly.com/video/generate" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Tea farms at sunrise, cinematic",
    "model": "sora-2",
    "seconds": 8,
    "size": "1280x720"
  }'
```

**Response:**
```json
{
  "success": true,
  "video_id": "video_abc123",
  "status": "queued",
  "progress": 0,
  "tenant": "user_demo_001",
  "credits_remaining": 99
}
```

**Check Status:**
```bash
curl -X GET "https://api.reelpostly.com/video/status/video_abc123" \
  -H "x-api-key: YOUR_API_KEY"
```

**Response (in progress):**
```json
{
  "success": true,
  "id": "video_abc123",
  "status": "processing",
  "progress": 45,
  "providerStatus": "in_progress"
}
```

**Response (completed):**
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

## Lambda Function Details

### `createVideo` Lambda
**Purpose**: Initiate video generation

**Flow**:
1. Validate API key from API Gateway context
2. Check tenant credits in DynamoDB
3. Decrement credits (prevents double-charging)
4. Call OpenAI Sora API (`POST /v1/videos`)
5. Return `video_id` to client

**Environment Variables**:
- `TABLE_NAME`: `reelpostly-tenants`
- `BUCKET_NAME`: `bigvideograb-media`

**Timeout**: 300 seconds  
**Memory**: 512 MB

### `checkStatus` Lambda
**Purpose**: Poll video generation status

**Flow**:
1. Validate API key
2. Call OpenAI status endpoint (`GET /v1/videos/{id}`)
3. Return status/progress to client
4. **On completion**:
   - Download video from OpenAI (`GET /v1/videos/{id}/content`)
   - Upload to S3 (`sora-api-videos/` prefix)
   - Return presigned URL (7-day expiry)

**Environment Variables**:
- `TABLE_NAME`: `reelpostly-tenants`
- `BUCKET_NAME`: `bigvideograb-media`

**Timeout**: 300 seconds  
**Memory**: 512 MB

## API Endpoints

### `POST /video/generate`
Creates a new video generation task.

**Headers**:
- `x-api-key`: Your API key (required)
- `Content-Type`: `application/json`

**Request Body**:
```json
{
  "prompt": "Describe your video scene",
  "model": "sora-2",           // or "sora-2-pro"
  "seconds": 8,                // 4, 8, or 12
  "size": "1280x720"           // 1280x720, 720x1280, 1024x1792, 1792x1024
}
```

**Response**:
```json
{
  "success": true,
  "video_id": "video_abc123",
  "status": "queued",
  "progress": 0,
  "tenant": "user_abc",
  "credits_remaining": 99
}
```

### `GET /video/status/{id}`
Check the status of a video generation task.

**Headers**:
- `x-api-key`: Your API key (required)

**Response (Processing)**:
```json
{
  "success": true,
  "id": "video_abc123",
  "status": "processing",
  "progress": 45,
  "providerStatus": "in_progress"
}
```

**Response (Completed)**:
```json
{
  "success": true,
  "id": "video_abc123",
  "status": "completed",
  "progress": 100,
  "url": "https://bigvideograb-media.s3.amazonaws.com/...",
  "filename": "video_abc123.mp4",
  "size": 1234567
}
```

## Credit Management

### DynamoDB Schema
```json
{
  "apiKeyId": "abcd1234",           // AWS API Gateway key ID (PK)
  "tenantId": "user_abc",           // Your internal user ID
  "email": "user@example.com",
  "planId": "starter",              // starter, pro, enterprise
  "credits": 100,                   // Remaining credits
  "status": "active",               // active, suspended, cancelled
  "createdAt": 1234567890
}
```

### Adding Credits
```bash
aws dynamodb update-item \
  --table-name reelpostly-tenants \
  --key '{"apiKeyId": {"S": "abcd1234"}}' \
  --update-expression "SET credits = credits + :inc" \
  --expression-attribute-values '{":inc": {"N": "100"}}' \
  --region us-west-2
```

### Checking Credits
```bash
aws dynamodb get-item \
  --table-name reelpostly-tenants \
  --key '{"apiKeyId": {"S": "abcd1234"}}' \
  --region us-west-2
```

## Usage Plans & Throttling

**Current Configuration**:
- **Rate Limit**: 10 requests/second
- **Burst Limit**: 20 requests
- **Monthly Quota**: 1,000 requests

**Modify Usage Plan**:
```bash
aws apigateway update-usage-plan \
  --usage-plan-id "abc123" \
  --patch-operations \
    op=replace,path=/throttle/rateLimit,value=20 \
    op=replace,path=/throttle/burstLimit,value=40 \
    op=replace,path=/quota/limit,value=5000
```

## Creating New API Keys

### 1. Create API Key
```bash
API_KEY_ID=$(aws apigateway create-api-key \
  --name "customer-abc-key" \
  --description "API key for customer ABC" \
  --enabled \
  --region us-west-2 \
  --query 'id' --output text)
```

### 2. Associate with Usage Plan
```bash
aws apigateway create-usage-plan-key \
  --usage-plan-id "YOUR_USAGE_PLAN_ID" \
  --key-type "API_KEY" \
  --key-id "$API_KEY_ID" \
  --region us-west-2
```

### 3. Add to DynamoDB
```bash
aws dynamodb put-item \
  --table-name reelpostly-tenants \
  --item "{
    \"apiKeyId\": {\"S\": \"$API_KEY_ID\"},
    \"tenantId\": {\"S\": \"customer_abc\"},
    \"email\": {\"S\": \"abc@example.com\"},
    \"planId\": {\"S\": \"starter\"},
    \"credits\": {\"N\": \"100\"},
    \"status\": {\"S\": \"active\"},
    \"createdAt\": {\"N\": \"$(date +%s)\"}
  }" \
  --region us-west-2
```

### 4. Get API Key Value
```bash
aws apigateway get-api-key \
  --api-key "$API_KEY_ID" \
  --include-value \
  --region us-west-2 \
  --query 'value' --output text
```

## Error Handling

### Common Errors

**401 Unauthorized**:
```json
{ "error": "Missing API key" }
```
→ Add `x-api-key` header

**402 Payment Required**:
```json
{ "error": "Insufficient credits" }
```
→ Add credits to tenant account

**400 Bad Request**:
```json
{ "error": "Missing required field: prompt" }
```
→ Check request body format

**500 Internal Server Error**:
```json
{ "error": "OpenAI API error 429: Rate limit exceeded" }
```
→ OpenAI account issue (add credits or check rate limits)

## Monitoring

### CloudWatch Logs
```bash
# View createVideo logs
aws logs tail /aws/lambda/reelpostly-createVideo-* --follow

# View checkStatus logs
aws logs tail /aws/lambda/reelpostly-checkStatus-* --follow
```

### API Gateway Metrics
```bash
# View API requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=ReelPostly-VideoAPI-* \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Cost Estimation

**AWS Costs** (approximate):
- API Gateway: $3.50 per million requests
- Lambda: $0.20 per million requests (with 512MB memory)
- DynamoDB: $0.25 per million read/write requests (on-demand)
- S3 Storage: $0.023 per GB/month
- S3 Bandwidth: $0.09 per GB transfer out

**OpenAI Costs**:
- Sora-2: Variable (check OpenAI pricing)

## Security Best Practices

1. **Never expose API keys**: Use API Gateway keys only
2. **Rotate keys regularly**: Generate new keys every 90 days
3. **Monitor usage**: Set up CloudWatch alarms for suspicious activity
4. **Limit rate**: Adjust throttling based on your needs
5. **Encrypt sensitive data**: Use SSM Parameter Store with encryption
6. **Use least privilege**: IAM roles have only required permissions

## Cleanup

To delete all resources created by this setup:

```bash
# Delete Lambda functions
aws lambda delete-function --function-name reelpostly-createVideo-*
aws lambda delete-function --function-name reelpostly-checkStatus-*

# Delete API Gateway
aws apigateway delete-rest-api --rest-api-id {api-id}

# Delete IAM role
aws iam delete-role --role-name reelpostly-lambda-role-*

# Delete DynamoDB table
aws dynamodb delete-table --table-name reelpostly-tenants

# Note: Replace * with actual timestamp suffix from setup output
```

## Support

For issues or questions:
1. Check CloudWatch logs for Lambda errors
2. Verify OpenAI API key in SSM Parameter Store
3. Ensure DynamoDB table exists with correct schema
4. Test API Gateway endpoints with `curl`

## Next Steps

### UI Dashboard (TODO)
Build a React UI to:
1. Display API keys
2. Show usage statistics
3. Manage credits
4. View video generation history
5. Handle Stripe payments for credit top-ups

### Enhanced Features (TODO)
- [ ] Webhook notifications on video completion
- [ ] Batch video generation
- [ ] Video preview thumbnails
- [ ] Custom video parameters (aspect ratio presets)
- [ ] Usage analytics dashboard
- [ ] Stripe integration for auto-recharge
- [ ] Multi-tier pricing plans
- [ ] Team/organization support

---

**Made with ❤️ by ReelPostly Team**

