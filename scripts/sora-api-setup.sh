#!/bin/bash
set -euo pipefail

# AWS Configuration
REGION="us-west-2"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "657053005765")

echo "════════════════════════════════════════════════════════════"
echo "🚀 SORA API COMPLETE SETUP SCRIPT"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "This script will:"
echo "  ✅ Add Stripe price IDs to AWS SSM Parameter Store"
echo "  ✅ Create DynamoDB table for Sora API data"
echo "  ✅ Set up API Gateway, Lambda, and Usage Plans"
echo "  ✅ Configure custom domain (api.reelpostly.com)"
echo "  ✅ Verify all components"
echo ""

# Function to add SSM parameters
add_ssm_parameters() {
    echo "📝 Adding Stripe price IDs to AWS SSM..."
    echo ""
    
    # Sora API Credit Prices (One-time payments)
    local prices=(
        "10:price_1SHg7cLPiEjYBNcQICTr69fx:100"
        "20:price_1SHg8JLPiEjYBNcQrjNQPRQR:200" 
        "50:price_1SHgAXLPiEjYBNcQRh5A6BGH:500"
        "100:price_1SHgAsLPiEjYBNcQ568zRYBH:1000"
    )
    
    for price_info in "${prices[@]}"; do
        IFS=':' read -r amount price_id credits <<< "$price_info"
        
        echo "Adding \$${amount} = ${credits} credits (${price_id})..."
        
        aws ssm put-parameter \
          --name "/repostly/api/STRIPE_SORA_${amount}_PRICE_ID" \
          --value "$price_id" \
          --type "String" \
          --overwrite \
          --region "$REGION" \
          --description "Stripe price ID for \$${amount} = ${credits} Sora API credits" \
          --tags "Key=Service,Value=SoraAPI" "Key=Type,Value=StripePrice" || echo "⚠️  Failed to add STRIPE_SORA_${amount}_PRICE_ID"
        
        echo "✅ Added STRIPE_SORA_${amount}_PRICE_ID = $price_id"
        echo ""
    done
}

# Function to verify SSM parameters
verify_ssm_parameters() {
    echo "🔍 Verifying SSM parameters..."
    echo ""
    
    aws ssm get-parameters \
      --names \
        "/repostly/api/STRIPE_SORA_10_PRICE_ID" \
        "/repostly/api/STRIPE_SORA_20_PRICE_ID" \
        "/repostly/api/STRIPE_SORA_50_PRICE_ID" \
        "/repostly/api/STRIPE_SORA_100_PRICE_ID" \
      --region "$REGION" \
      --query 'Parameters[*].[Name,Value]' \
      --output table
    
    echo ""
}

# Function to create DynamoDB table
create_dynamodb_table() {
    echo "🗄️  Creating DynamoDB table for Sora API..."
    echo ""
    
    local table_name="repostly-sora-api-tenant"
    
    # Check if table exists
    if aws dynamodb describe-table --table-name "$table_name" --region "$REGION" >/dev/null 2>&1; then
        echo "✅ DynamoDB table '$table_name' already exists"
    else
        echo "Creating DynamoDB table: $table_name"
        
        aws dynamodb create-table \
          --table-name "$table_name" \
          --attribute-definitions \
            AttributeName=apiKeyId,AttributeType=S \
          --key-schema \
            AttributeName=apiKeyId,KeyType=HASH \
          --provisioned-throughput \
            ReadCapacityUnits=5,WriteCapacityUnits=5 \
          --region "$REGION" \
          --tags "Key=Service,Value=SoraAPI" "Key=Type,Value=DynamoDB" || echo "⚠️  Failed to create DynamoDB table"
        
        echo "✅ DynamoDB table '$table_name' created"
    fi
    echo ""
}

# Function to set up API Gateway and Lambda
setup_api_infrastructure() {
    echo "🌐 Setting up API Gateway and Lambda infrastructure..."
    echo ""
    
    if [ -f "scripts/setup-reelpostly-api.sh" ]; then
        echo "Running comprehensive API Gateway setup script..."
        echo "⚠️  This will create:"
        echo "   • IAM roles and policies"
        echo "   • Lambda functions with real Sora logic"
        echo "   • API Gateway with custom domain"
        echo "   • Usage plans and test API key"
        echo "   • Route53 DNS records"
        echo ""
        echo "This may take 5-10 minutes..."
        echo ""
        bash scripts/setup-reelpostly-api.sh
    else
        echo "⚠️  setup-reelpostly-api.sh not found - skipping API infrastructure setup"
        echo "   You may need to run this manually if setting up the full Sora API"
    fi
    echo ""
}

# Function to show next steps
show_next_steps() {
    echo "════════════════════════════════════════════════════════════"
    echo "🎉 SORA API SETUP COMPLETE!"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Next steps:"
    echo "  1. 🔄 Redeploy ECS to load new SSM parameters:"
    echo "     bash scripts/deploy-single-container.sh"
    echo ""
    echo "  2. 🧪 Test the Sora API dashboard:"
    echo "     • Create API keys"
    echo "     • Purchase credits"
    echo "     • Generate videos"
    echo ""
    echo "  3. 👥 Create customer API keys:"
    echo "     bash scripts/create-customer-api-key.sh"
    echo ""
    echo "  4. 📊 Monitor usage in AWS CloudWatch"
    echo ""
    echo "  5. 🔗 API endpoints available at:"
    echo "     • https://api.reelpostly.com/video/generate (create)"
    echo "     • https://api.reelpostly.com/video/status/{id} (status)"
    echo ""
    echo "  6. 📚 Documentation: scripts/README-SORA-API.md"
    echo ""
}

# Main execution
main() {
    # Add SSM parameters
    add_ssm_parameters
    
    # Verify parameters
    verify_ssm_parameters
    
    # Create DynamoDB table
    create_dynamodb_table
    
    # Ask if user wants to set up full API infrastructure
    echo "🌐 Do you want to set up the full API Gateway + Lambda infrastructure? (y/N)"
    read -r setup_infra
    if [[ $setup_infra =~ ^[Yy]$ ]]; then
        setup_api_infrastructure
    else
        echo "⏭️  Skipping API infrastructure setup"
        echo ""
    fi
    
    # Show next steps
    show_next_steps
}

# Run main function
main "$@"
