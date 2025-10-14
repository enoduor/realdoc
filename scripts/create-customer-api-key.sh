#!/bin/bash
# Create API key for new Sora API customer

REGION="us-west-2"
USAGE_PLAN_ID="9xcjpf"  # Most recent usage plan
TABLE_NAME="reelpostly-tenants"

# Get customer details
read -p "Customer Name: " CUSTOMER_NAME
read -p "Customer Email: " CUSTOMER_EMAIL
read -p "Initial Credits [10]: " INITIAL_CREDITS
INITIAL_CREDITS=${INITIAL_CREDITS:-10}

echo ""
echo "Creating API key for $CUSTOMER_NAME..."

# Create API key
API_KEY_ID=$(aws apigateway create-api-key \
  --name "customer-${CUSTOMER_NAME// /-}-$(date +%s)" \
  --description "API key for $CUSTOMER_NAME" \
  --enabled \
  --region "$REGION" \
  --query 'id' --output text)

echo "✓ API Key ID: $API_KEY_ID"

# Link to usage plan
aws apigateway create-usage-plan-key \
  --usage-plan-id "$USAGE_PLAN_ID" \
  --key-type "API_KEY" \
  --key-id "$API_KEY_ID" \
  --region "$REGION" >/dev/null

echo "✓ Linked to usage plan"

# Get API key value
API_KEY_VALUE=$(aws apigateway get-api-key \
  --api-key "$API_KEY_ID" \
  --include-value \
  --region "$REGION" \
  --query 'value' --output text)

# Add to DynamoDB
TENANT_ID="customer_$(echo $CUSTOMER_NAME | tr '[:upper:]' '[:lower:]' | tr ' ' '_')_$(date +%s)"
TIMESTAMP=$(date +%s)

aws dynamodb put-item \
  --table-name "$TABLE_NAME" \
  --item "{
    \"apiKeyId\": {\"S\": \"$API_KEY_ID\"},
    \"tenantId\": {\"S\": \"$TENANT_ID\"},
    \"email\": {\"S\": \"$CUSTOMER_EMAIL\"},
    \"planId\": {\"S\": \"starter\"},
    \"credits\": {\"N\": \"$INITIAL_CREDITS\"},
    \"status\": {\"S\": \"active\"},
    \"createdAt\": {\"N\": \"$TIMESTAMP\"}
  }" \
  --region "$REGION" >/dev/null

echo "✓ Added to database"
echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                         ✅ API KEY CREATED                                 ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Customer: $CUSTOMER_NAME"
echo "Email: $CUSTOMER_EMAIL"
echo "Tenant ID: $TENANT_ID"
echo ""
echo "═══════════════ SEND THIS TO CUSTOMER ═══════════════"
echo ""
echo "Hi $CUSTOMER_NAME,"
echo ""
echo "Your ReelPostly Sora API access is ready!"
echo ""
echo "API Key: $API_KEY_VALUE"
echo "Endpoint: https://api.reelpostly.com"
echo "Credits: $INITIAL_CREDITS videos"
echo ""
echo "Documentation: https://github.com/yourrepo/sora-api-docs"
echo ""
echo "Example:"
echo "curl -X POST \"https://api.reelpostly.com/video/generate\" \\"
echo "  -H \"x-api-key: $API_KEY_VALUE\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"prompt\":\"Your video\",\"model\":\"sora-2\",\"seconds\":4,\"size\":\"1280x720\"}'"
echo ""
echo "═════════════════════════════════════════════════════"
