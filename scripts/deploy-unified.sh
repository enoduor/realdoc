#!/bin/bash
set -euo pipefail

# Deploy single unified container (alternative to existing setup)
# This creates a new service alongside your existing ones

echo "🚀 Deploying unified container to AWS..."

# Set environment variables
export AWS_ACCOUNT_ID=657053005765
export AWS_REGION=us-west-2

# Deploy single container
echo "📦 Building and deploying unified container..."
./scripts/deploy-single-container.sh

echo "✅ Unified deployment complete!"
echo "🌐 Your unified app is available at your ALB URL"
echo "📊 You now have both multi-container and unified deployments running"
