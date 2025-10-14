#!/usr/bin/env bash
set -euo pipefail

# Create DynamoDB table for API key/tenant management
REGION="us-west-2"
TABLE_NAME="reelpostly-tenants"

echo "Creating DynamoDB table: $TABLE_NAME"

aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=apiKeyId,AttributeType=S \
  --key-schema \
    AttributeName=apiKeyId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

echo "Waiting for table to be active..."
aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"

echo "✅ Table $TABLE_NAME created successfully"
echo ""
echo "Table schema:"
echo "  - Primary Key: apiKeyId (String) - AWS API Gateway API key ID"
echo "  - Attributes: tenantId, planId, credits, status, email, createdAt"
echo ""
echo "Now you can run: bash scripts/setup-reelpostly-api.sh"

