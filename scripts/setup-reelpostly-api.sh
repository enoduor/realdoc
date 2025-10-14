#!/usr/bin/env bash
set -euo pipefail

# ======= CONFIGURE =======
REGION="us-west-2"
TABLE_NAME="reelpostly-tenants"    # Must already exist with PK: apiKeyId (String)
STAGE_NAME="prod"

# Custom Domain
CUSTOM_DOMAIN="api.reelpostly.com"
HOSTED_ZONE_ID="Z0118191RMXUZYKLQ0SU"  # reelpostly.com zone

# Plan + throttling
USAGE_PLAN_NAME="ReelPostly-Starter-Plan"
USAGE_PLAN_DESC="Starter plan for paid Sora video API"
THROTTLE_RATE=10
THROTTLE_BURST=20
MONTHLY_QUOTA=1000

# Tenant seed (for test key)
TENANT_ID="user_demo_001"
TENANT_EMAIL="demo@reelpostly.com"
TENANT_PLAN="starter"
TENANT_CREDITS=10
TENANT_STATUS="active"

# ======= AUTO NAMES (unique with timestamp) =======
TS="$(date +%s)"
API_NAME="ReelPostly-VideoAPI-$TS"
ROLE_NAME="reelpostly-lambda-role-$TS"
LAMBDA_CREATE="reelpostly-createVideo-$TS"
LAMBDA_STATUS="reelpostly-checkStatus-$TS"
API_KEY_NAME="reelpostly-starter-key-$TS"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

echo "Region: $REGION"
echo "Account: $ACCOUNT_ID"
echo "Unique suffix: $TS"

# ======= 2) Create IAM role for Lambda =======
echo "Creating IAM role: $ROLE_NAME"
aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' >/dev/null

# Attach basic execution policy (CloudWatch Logs)
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Attach DynamoDB access for credit management
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# Attach S3 access for video uploads
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Attach SSM Parameter Store access for OpenAI API key
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess

echo "Waiting for role to become assumable..."
aws iam get-role --role-name "$ROLE_NAME" >/dev/null

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo "ROLE_ARN=$ROLE_ARN"
echo "Waiting 10 seconds for IAM role to propagate..."
sleep 10

# ======= 3) Create Lambda handlers with real Sora logic =======
mkdir -p /tmp/reelpostly-lambdas

# createVideo handler (REAL): calls OpenAI Sora API
cat >/tmp/reelpostly-lambdas/createVideo.js <<'JS'
const https = require('https');
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();

// Get OpenAI API key from SSM
async function getOpenAIKey() {
  const param = await ssm.getParameter({
    Name: '/repostly/OPENAI_API_KEY',
    WithDecryption: true
  }).promise();
  return param.Parameter.Value;
}

// Validate API key and get tenant info
async function getTenant(apiKeyId) {
  const result = await dynamodb.get({
    TableName: process.env.TABLE_NAME || 'reelpostly-tenants',
    Key: { apiKeyId }
  }).promise();
  
  if (!result.Item) {
    throw new Error('Invalid API key');
  }
  
  if (result.Item.status !== 'active') {
    throw new Error('Account is not active');
  }
  
  if (result.Item.credits <= 0) {
    throw new Error('Insufficient credits');
  }
  
  return result.Item;
}

// Decrement credits
async function decrementCredits(apiKeyId) {
  await dynamodb.update({
    TableName: process.env.TABLE_NAME || 'reelpostly-tenants',
    Key: { apiKeyId },
    UpdateExpression: 'SET credits = credits - :dec',
    ExpressionAttributeValues: { ':dec': 1 }
  }).promise();
}

// Call OpenAI Sora API
async function createSoraVideo(apiKey, { prompt, model, seconds, size }) {
  return new Promise((resolve, reject) => {
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('prompt', prompt);
    form.append('model', model || 'sora-2');
    form.append('seconds', String(seconds || 8));
    form.append('size', size || '720x1280');
    
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/videos',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders()
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`OpenAI API error ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response from OpenAI'));
          }
        }
      });
    });
    
    req.on('error', reject);
    form.pipe(req);
  });
}

exports.handler = async (event) => {
  try {
    // Get API key ID from API Gateway context
    const apiKeyId = event.requestContext?.identity?.apiKeyId;
    if (!apiKeyId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing API key' })
      };
    }
    
    // Validate tenant
    const tenant = await getTenant(apiKeyId);
    
    // Parse request
    const body = JSON.parse(event.body || '{}');
    if (!body.prompt) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required field: prompt' })
      };
    }
    
    // Get OpenAI API key
    const openaiKey = await getOpenAIKey();
    
    // Decrement credits BEFORE calling API
    await decrementCredits(apiKeyId);
    
    // Call OpenAI Sora API
    const result = await createSoraVideo(openaiKey, body);
    
    // Return video_id
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        video_id: result.id,
        status: result.status || 'queued',
        progress: result.progress || 0,
        tenant: tenant.tenantId,
        credits_remaining: tenant.credits - 1
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.message.includes('credits') ? 402 : 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
JS

# checkStatus handler (REAL): checks OpenAI status, downloads video, uploads to S3
cat >/tmp/reelpostly-lambdas/checkStatus.js <<'JS'
const https = require('https');
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const ssm = new AWS.SSM();

// Get OpenAI API key from SSM
async function getOpenAIKey() {
  const param = await ssm.getParameter({
    Name: '/repostly/OPENAI_API_KEY',
    WithDecryption: true
  }).promise();
  return param.Parameter.Value;
}

// Validate API key
async function validateTenant(apiKeyId) {
  const result = await dynamodb.get({
    TableName: process.env.TABLE_NAME || 'reelpostly-tenants',
    Key: { apiKeyId }
  }).promise();
  
  if (!result.Item || result.Item.status !== 'active') {
    throw new Error('Invalid or inactive API key');
  }
  
  return result.Item;
}

// HTTPS GET helper
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        }
      });
    }).on('error', reject);
  });
}

// Download binary video
function downloadVideo(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Check OpenAI video status
async function checkOpenAIStatus(apiKey, videoId) {
  const url = `https://api.openai.com/v1/videos/${videoId}`;
  return httpsGet(url, { 'Authorization': `Bearer ${apiKey}` });
}

// Upload to S3
async function uploadToS3(buffer, filename) {
  const bucketName = process.env.BUCKET_NAME || 'bigvideograb-media';
  const key = `sora-api-videos/${Date.now()}-${filename}`;
  
  await s3.putObject({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: 'video/mp4',
    Metadata: {
      'source': 'sora-api',
      'video-id': filename.replace('.mp4', '')
    }
  }).promise();
  
  // Generate presigned URL (7 days)
  return s3.getSignedUrl('getObject', {
    Bucket: bucketName,
    Key: key,
    Expires: 604800
  });
}

exports.handler = async (event) => {
  try {
    // Validate API key
    const apiKeyId = event.requestContext?.identity?.apiKeyId;
    if (!apiKeyId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing API key' })
      };
    }
    
    await validateTenant(apiKeyId);
    
    // Get video ID from path
    const videoId = event.pathParameters?.id;
    if (!videoId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing video ID' })
      };
    }
    
    // Get OpenAI API key
    const openaiKey = await getOpenAIKey();
    
    // Check status
    const statusData = await checkOpenAIStatus(openaiKey, videoId);
    
    // Normalize status
    const providerStatus = (statusData.status || '').toLowerCase();
    const statusMap = {
      'queued': 'queued',
      'in_progress': 'processing',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled'
    };
    
    const appStatus = statusMap[providerStatus] || 'processing';
    const progress = statusData.progress || (appStatus === 'completed' ? 100 : 0);
    
    const response = {
      success: true,
      id: videoId,
      status: appStatus,
      progress,
      providerStatus
    };
    
    // If completed, download and upload to S3
    if (appStatus === 'completed') {
      try {
        const downloadUrl = `https://api.openai.com/v1/videos/${videoId}/content`;
        const videoBuffer = await downloadVideo(downloadUrl, { 'Authorization': `Bearer ${openaiKey}` });
        
        const filename = `${videoId}.mp4`;
        const s3Url = await uploadToS3(videoBuffer, filename);
        
        response.url = s3Url;
        response.filename = filename;
        response.size = videoBuffer.length;
      } catch (downloadError) {
        console.error('Download/upload error:', downloadError);
        response.error = `Video completed but failed to download: ${downloadError.message}`;
      }
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
JS

# Create package.json for dependencies
cat >/tmp/reelpostly-lambdas/package.json <<'JSON'
{
  "name": "reelpostly-lambda-sora",
  "version": "1.0.0",
  "dependencies": {
    "form-data": "^4.0.0"
  }
}
JSON

# Install dependencies
echo "Installing Lambda dependencies..."
pushd /tmp/reelpostly-lambdas >/dev/null
npm install --production --silent 2>/dev/null || echo "Warning: npm install had issues, continuing..."

# Zip them with node_modules
zip -qr createVideo.zip createVideo.js node_modules 2>/dev/null || zip -q createVideo.zip createVideo.js
zip -qr checkStatus.zip checkStatus.js node_modules 2>/dev/null || zip -q checkStatus.zip checkStatus.js
popd >/dev/null

# ======= 4) Create Lambda functions =======
# Get S3 bucket name from environment or use default
S3_BUCKET_NAME="${AWS_BUCKET_NAME:-bigvideograb-media}"

echo "Creating Lambda: $LAMBDA_CREATE"
aws lambda create-function \
  --function-name "$LAMBDA_CREATE" \
  --runtime nodejs18.x \
  --role "$ROLE_ARN" \
  --handler createVideo.handler \
  --zip-file fileb:///tmp/reelpostly-lambdas/createVideo.zip \
  --timeout 300 \
  --memory-size 512 \
  --environment "Variables={TABLE_NAME=$TABLE_NAME,BUCKET_NAME=$S3_BUCKET_NAME}" \
  --region "$REGION" >/dev/null

echo "Creating Lambda: $LAMBDA_STATUS"
aws lambda create-function \
  --function-name "$LAMBDA_STATUS" \
  --runtime nodejs18.x \
  --role "$ROLE_ARN" \
  --handler checkStatus.handler \
  --zip-file fileb:///tmp/reelpostly-lambdas/checkStatus.zip \
  --timeout 300 \
  --memory-size 512 \
  --environment "Variables={TABLE_NAME=$TABLE_NAME,BUCKET_NAME=$S3_BUCKET_NAME}" \
  --region "$REGION" >/dev/null

CREATE_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_CREATE}"
STATUS_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_STATUS}"

# ======= 5) Create REST API and resources =======
REST_API_ID=$(aws apigateway create-rest-api \
  --name "$API_NAME" \
  --description "ReelPostly video API with usage plan + API key" \
  --region "$REGION" \
  --query 'id' --output text)
echo "REST_API_ID=$REST_API_ID"

ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id "$REST_API_ID" \
  --region "$REGION" \
  --query 'items[?path==`/`].id' --output text)

VIDEO_ID=$(aws apigateway create-resource \
  --rest-api-id "$REST_API_ID" \
  --parent-id "$ROOT_ID" \
  --path-part "video" \
  --region "$REGION" \
  --query 'id' --output text)

GEN_ID=$(aws apigateway create-resource \
  --rest-api-id "$REST_API_ID" \
  --parent-id "$VIDEO_ID" \
  --path-part "generate" \
  --region "$REGION" \
  --query 'id' --output text)

STATUS_ID=$(aws apigateway create-resource \
  --rest-api-id "$REST_API_ID" \
  --parent-id "$VIDEO_ID" \
  --path-part "status" \
  --region "$REGION" \
  --query 'id' --output text)

STATUS_PARAM_ID=$(aws apigateway create-resource \
  --rest-api-id "$REST_API_ID" \
  --parent-id "$STATUS_ID" \
  --path-part "{id}" \
  --region "$REGION" \
  --query 'id' --output text)

# ======= 6) Methods + proxy integrations + API key required =======
# POST /video/generate
aws apigateway put-method \
  --rest-api-id "$REST_API_ID" \
  --resource-id "$GEN_ID" \
  --http-method POST \
  --authorization-type "NONE" \
  --api-key-required \
  --region "$REGION"

aws apigateway put-integration \
  --rest-api-id "$REST_API_ID" \
  --resource-id "$GEN_ID" \
  --http-method POST \
  --type "AWS_PROXY" \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${CREATE_ARN}/invocations" \
  --region "$REGION"

aws lambda add-permission \
  --function-name "$LAMBDA_CREATE" \
  --statement-id "apigwInvokeCreate-$TS" \
  --action "lambda:InvokeFunction" \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/POST/video/generate" \
  --region "$REGION" >/dev/null || true

# GET /video/status/{id}
aws apigateway put-method \
  --rest-api-id "$REST_API_ID" \
  --resource-id "$STATUS_PARAM_ID" \
  --http-method GET \
  --authorization-type "NONE" \
  --api-key-required \
  --request-parameters "method.request.path.id=true" \
  --region "$REGION"

aws apigateway put-integration \
  --rest-api-id "$REST_API_ID" \
  --resource-id "$STATUS_PARAM_ID" \
  --http-method GET \
  --type "AWS_PROXY" \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${STATUS_ARN}/invocations" \
  --region "$REGION"

aws lambda add-permission \
  --function-name "$LAMBDA_STATUS" \
  --statement-id "apigwInvokeStatus-$TS" \
  --action "lambda:InvokeFunction" \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/GET/video/status/*" \
  --region "$REGION" >/dev/null || true

# ======= 7) CORS helper =======
enable_cors () {
  local RESOURCE_ID=$1
  local METHODS=$2
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" \
    --resource-id "$RESOURCE_ID" \
    --http-method OPTIONS \
    --authorization-type "NONE" \
    --region "$REGION" >/dev/null

  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" \
    --resource-id "$RESOURCE_ID" \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
    --region "$REGION" >/dev/null

  aws apigateway put-method-response \
    --rest-api-id "$REST_API_ID" \
    --resource-id "$RESOURCE_ID" \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true" \
    --response-models '{"application/json":"Empty"}' \
    --region "$REGION" >/dev/null

  aws apigateway put-integration-response \
    --rest-api-id "$REST_API_ID" \
    --resource-id "$RESOURCE_ID" \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,X-Api-Key,Authorization'\",\"method.response.header.Access-Control-Allow-Methods\":\"'${METHODS}'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" \
    --response-templates '{"application/json":""}' \
    --region "$REGION" >/dev/null
}

enable_cors "$GEN_ID" "POST,OPTIONS"
enable_cors "$STATUS_PARAM_ID" "GET,OPTIONS"

# ======= 8) Deploy stage =======
aws apigateway create-deployment \
  --rest-api-id "$REST_API_ID" \
  --stage-name "$STAGE_NAME" \
  --description "Initial deployment $TS" \
  --region "$REGION" >/dev/null

INVOKE_URL="https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE_NAME}"
echo "=== Invoke URLs ==="
echo "POST $INVOKE_URL/video/generate"
echo "GET  $INVOKE_URL/video/status/{id}"

# ======= 9) Usage plan + API key =======
USAGE_PLAN_ID=$(aws apigateway create-usage-plan \
  --name "$USAGE_PLAN_NAME-$TS" \
  --description "$USAGE_PLAN_DESC" \
  --throttle "rateLimit=${THROTTLE_RATE},burstLimit=${THROTTLE_BURST}" \
  --quota "limit=${MONTHLY_QUOTA},period=MONTH" \
  --api-stages "apiId=${REST_API_ID},stage=${STAGE_NAME}" \
  --region "$REGION" \
  --query 'id' --output text)

API_KEY_ID=$(aws apigateway create-api-key \
  --name "$API_KEY_NAME" \
  --description "Starter API key $TS" \
  --enabled \
  --region "$REGION" \
  --query 'id' --output text)

aws apigateway create-usage-plan-key \
  --usage-plan-id "$USAGE_PLAN_ID" \
  --key-type "API_KEY" \
  --key-id "$API_KEY_ID" \
  --region "$REGION" >/dev/null

API_KEY_VALUE=$(aws apigateway get-api-key \
  --api-key "$API_KEY_ID" \
  --include-value \
  --region "$REGION" \
  --query 'value' --output text)

echo "USAGE_PLAN_ID=$USAGE_PLAN_ID"
echo "API_KEY_ID=$API_KEY_ID"
echo "API_KEY_VALUE=$API_KEY_VALUE   # Use in x-api-key header"

# ======= 10) Seed DynamoDB (link API key ID to tenant) =======
TIMESTAMP=$(date +%s)
aws dynamodb put-item \
  --table-name "$TABLE_NAME" \
  --item "{
    \"apiKeyId\": {\"S\":\"$API_KEY_ID\"},
    \"tenantId\": {\"S\":\"$TENANT_ID\"},
    \"planId\": {\"S\":\"$TENANT_PLAN\"},
    \"credits\": {\"N\":\"$TENANT_CREDITS\"},
    \"status\": {\"S\":\"$TENANT_STATUS\"},
    \"email\": {\"S\":\"$TENANT_EMAIL\"},
    \"createdAt\": {\"N\":\"$TIMESTAMP\"}
  }" \
  --region "$REGION" >/dev/null

echo "DynamoDB tenant seeded: apiKeyId=$API_KEY_ID"

# ======= 11) Custom Domain Setup =======
echo ""
echo "Setting up custom domain: $CUSTOM_DOMAIN"

# Check if certificate already exists
CERT_ARN=$(aws acm list-certificates --region "$REGION" \
  --query "CertificateSummaryList[?DomainName=='$CUSTOM_DOMAIN' && Status=='ISSUED'].CertificateArn | [0]" \
  --output text)

if [ "$CERT_ARN" == "None" ] || [ -z "$CERT_ARN" ]; then
  echo "Requesting SSL certificate for $CUSTOM_DOMAIN..."
  CERT_ARN=$(aws acm request-certificate \
    --domain-name "$CUSTOM_DOMAIN" \
    --validation-method DNS \
    --region "$REGION" \
    --query 'CertificateArn' --output text)
  
  echo "Certificate requested: $CERT_ARN"
  echo "Waiting for DNS validation records..."
  sleep 5
  
  # Get validation record
  VALIDATION_RECORD=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$REGION" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
    --output json)
  
  VALIDATION_NAME=$(echo "$VALIDATION_RECORD" | jq -r '.Name')
  VALIDATION_VALUE=$(echo "$VALIDATION_RECORD" | jq -r '.Value')
  VALIDATION_TYPE=$(echo "$VALIDATION_RECORD" | jq -r '.Type')
  
  echo "Creating DNS validation record..."
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "{
      \"Changes\": [{
        \"Action\": \"UPSERT\",
        \"ResourceRecordSet\": {
          \"Name\": \"$VALIDATION_NAME\",
          \"Type\": \"$VALIDATION_TYPE\",
          \"TTL\": 300,
          \"ResourceRecords\": [{\"Value\": \"\\\"$VALIDATION_VALUE\\\"\"}]
        }
      }]
    }" >/dev/null
  
  echo "Waiting for certificate validation (this may take 2-5 minutes)..."
  aws acm wait certificate-validated --certificate-arn "$CERT_ARN" --region "$REGION" || {
    echo "⚠️  Certificate validation taking longer than expected."
    echo "    You can check status with: aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION"
    echo "    Continuing with setup (custom domain will activate once validated)..."
  }
else
  echo "Using existing certificate: $CERT_ARN"
fi

# Create custom domain in API Gateway
echo "Creating custom domain in API Gateway..."
REGIONAL_DOMAIN=$(aws apigateway create-domain-name \
  --domain-name "$CUSTOM_DOMAIN" \
  --regional-certificate-arn "$CERT_ARN" \
  --endpoint-configuration types=REGIONAL \
  --region "$REGION" \
  --query 'regionalDomainName' --output text 2>&1)

if [[ "$REGIONAL_DOMAIN" == *"ConflictException"* ]]; then
  echo "Custom domain already exists, retrieving..."
  REGIONAL_DOMAIN=$(aws apigateway get-domain-name \
    --domain-name "$CUSTOM_DOMAIN" \
    --region "$REGION" \
    --query 'regionalDomainName' --output text)
fi

echo "Regional domain: $REGIONAL_DOMAIN"

# Create base path mapping
echo "Creating base path mapping..."
aws apigateway create-base-path-mapping \
  --domain-name "$CUSTOM_DOMAIN" \
  --rest-api-id "$REST_API_ID" \
  --stage "$STAGE_NAME" \
  --region "$REGION" 2>/dev/null || echo "Base path mapping may already exist"

# Create Route53 DNS record
echo "Creating Route53 DNS record..."
REGIONAL_ZONE_ID=$(aws apigateway get-domain-name \
  --domain-name "$CUSTOM_DOMAIN" \
  --region "$REGION" \
  --query 'regionalHostedZoneId' --output text)

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"$CUSTOM_DOMAIN\",
        \"Type\": \"A\",
        \"AliasTarget\": {
          \"HostedZoneId\": \"$REGIONAL_ZONE_ID\",
          \"DNSName\": \"$REGIONAL_DOMAIN\",
          \"EvaluateTargetHealth\": false
        }
      }
    }]
  }" >/dev/null

echo "✅ Custom domain configured: https://$CUSTOM_DOMAIN"

echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                   ✅ REELPOSTLY SORA API - SETUP COMPLETE                  ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎥 REAL SORA INTEGRATION:"
echo "   ✓ Lambda functions call OpenAI Sora API directly"
echo "   ✓ Credit management via DynamoDB"
echo "   ✓ Video downloads from OpenAI on completion"
echo "   ✓ Automatic S3 uploads with presigned URLs"
echo "   ✓ API key validation on every request"
echo ""
echo "📊 INFRASTRUCTURE:"
echo "   Custom Domain: https://$CUSTOM_DOMAIN"
echo "   API Gateway: $REST_API_ID"
echo "   Usage Plan: $USAGE_PLAN_ID (${THROTTLE_RATE} req/s, ${MONTHLY_QUOTA}/month)"
echo "   DynamoDB: $TABLE_NAME"
echo "   S3 Bucket: $S3_BUCKET_NAME"
echo ""
echo "🔑 TEST API KEY:"
echo "   API Key ID: $API_KEY_ID"
echo "   API Key Value: $API_KEY_VALUE"
echo "   Tenant: $TENANT_ID ($TENANT_EMAIL)"
echo "   Credits: $TENANT_CREDITS"
echo ""
echo "🚀 PUBLIC ENDPOINTS (Custom Domain):"
echo "   POST https://$CUSTOM_DOMAIN/video/generate"
echo "   GET  https://$CUSTOM_DOMAIN/video/status/{id}"
echo ""
echo "🔧 INTERNAL ENDPOINTS (AWS):"
echo "   POST $INVOKE_URL/video/generate"
echo "   GET  $INVOKE_URL/video/status/{id}"
echo ""
echo "🧪 TEST COMMAND:"
echo "curl -X POST \"https://$CUSTOM_DOMAIN/video/generate\" \\"
echo "  -H \"x-api-key: $API_KEY_VALUE\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"prompt\":\"Tea farms at sunrise, cinematic\",\"model\":\"sora-2\",\"seconds\":8,\"size\":\"1280x720\"}'"
echo ""
echo "⏱️  DNS propagation may take 1-5 minutes. If $CUSTOM_DOMAIN doesn't resolve immediately,"
echo "    use the internal AWS endpoint above for testing."
echo ""
echo "📝 NOTE: OpenAI API key is read from SSM Parameter: /repostly/OPENAI_API_KEY"
echo ""

