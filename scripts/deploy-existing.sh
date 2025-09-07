#!/bin/bash
set -euo pipefail

# Deploy using existing multi-container setup
# This keeps your current AWS infrastructure intact

echo "🚀 Deploying to existing AWS infrastructure..."

# Set environment variables
export AWS_ACCOUNT_ID=657053005765
export AWS_REGION=us-west-2

# Deploy all services using existing setup
echo "📦 Building and deploying all services..."
./scripts/deploy-repostly.sh all

echo "✅ Deployment complete!"
echo "🌐 Your app is available at your ALB URL"
