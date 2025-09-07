#!/bin/bash
set -euo pipefail

# Production deployment script for Repostly
# Sets the correct environment variables for production URLs

# Production URLs (replace with your actual domain when you have one)
ALB_DNS="videograb-alb-1069883284.us-west-2.elb.amazonaws.com"
PRODUCTION_BASE_URL="https://${ALB_DNS}"

# Set production environment variables
export REACT_APP_API_URL="${PRODUCTION_BASE_URL}/repostly/api"
export REACT_APP_PYTHON_API_URL="${PRODUCTION_BASE_URL}/repostly/ai"

# Set Clerk publishable key (replace with your production key)
export REACT_APP_CLERK_PUBLISHABLE_KEY="${REACT_APP_CLERK_PUBLISHABLE_KEY:-pk_test_YW1hemVkLWdyb3VzZS03NS5jbGVyay5hY2NvdW50cy5kZXYk}"

echo "🚀 Deploying Repostly to Production..."
echo "📡 API URL: $REACT_APP_API_URL"
echo "🤖 AI URL: $REACT_APP_PYTHON_API_URL"
echo "🔐 Clerk Key: ${REACT_APP_CLERK_PUBLISHABLE_KEY:0:20}..."

# Deploy all services
./scripts/deploy-repostly.sh all

echo "✅ Production deployment complete!"
echo "🌐 Frontend: ${PRODUCTION_BASE_URL}/repostly/"
echo "📚 API Docs: ${PRODUCTION_BASE_URL}/repostly/ai/docs"
