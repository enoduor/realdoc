#!/bin/bash
set -euo pipefail

# Script to set up SSM parameters for Repostly production
# Run this once to store your production secrets securely

AWS_REGION="${AWS_REGION:-us-west-2}"

echo "🔐 Setting up SSM parameters for Repostly..."

# Function to create or update SSM parameter
create_parameter() {
    local name="$1"
    local value="$2"
    local description="$3"
    
    echo "Setting parameter: $name"
    aws ssm put-parameter \
        --name "$name" \
        --value "$value" \
        --type "SecureString" \
        --description "$description" \
        --region "$AWS_REGION" \
        --overwrite
}

# MongoDB Atlas Connection String
read -p "Enter MongoDB Atlas connection string: " MONGODB_URI
create_parameter "/repostly/api/MONGODB_URI" "$MONGODB_URI" "MongoDB Atlas connection string for API"

# Clerk Keys
read -p "Enter Clerk Publishable Key: " CLERK_PUBLISHABLE_KEY
create_parameter "/repostly/api/CLERK_PUBLISHABLE_KEY" "$CLERK_PUBLISHABLE_KEY" "Clerk publishable key for API"

read -p "Enter Clerk Secret Key: " CLERK_SECRET_KEY
create_parameter "/repostly/api/CLERK_SECRET_KEY" "$CLERK_SECRET_KEY" "Clerk secret key for API"

# OpenAI API Key
read -p "Enter OpenAI API Key: " OPENAI_API_KEY
create_parameter "/repostly/ai/OPENAI_API_KEY" "$OPENAI_API_KEY" "OpenAI API key for AI service"

# AWS S3 Configuration
read -p "Enter AWS S3 Bucket Name: " S3_BUCKET_NAME
create_parameter "/repostly/ai/S3_BUCKET_NAME" "$S3_BUCKET_NAME" "AWS S3 bucket name for media storage"

read -p "Enter AWS Access Key ID: " AWS_ACCESS_KEY_ID
create_parameter "/repostly/ai/AWS_ACCESS_KEY_ID" "$AWS_ACCESS_KEY_ID" "AWS access key ID for S3"

read -p "Enter AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
create_parameter "/repostly/ai/AWS_SECRET_ACCESS_KEY" "$AWS_SECRET_ACCESS_KEY" "AWS secret access key for S3"

read -p "Enter AWS Region: " AWS_REGION
create_parameter "/repostly/ai/AWS_REGION" "$AWS_REGION" "AWS region for S3"

# Stripe Keys (if using)
read -p "Enter Stripe Secret Key (or press Enter to skip): " STRIPE_SECRET_KEY
if [ -n "$STRIPE_SECRET_KEY" ]; then
    create_parameter "/repostly/api/STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY" "Stripe secret key for payments"
fi

read -p "Enter Stripe Webhook Secret (or press Enter to skip): " STRIPE_WEBHOOK_SECRET
if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
    create_parameter "/repostly/api/STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET" "Stripe webhook secret for payments"
fi

echo "✅ All SSM parameters created successfully!"
echo "🔍 You can view them in AWS Console: https://console.aws.amazon.com/systems-manager/parameters"
