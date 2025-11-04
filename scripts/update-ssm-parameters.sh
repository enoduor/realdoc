#!/bin/bash
# update-ssm-parameters.sh - Centralized SSM Parameter Management

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-west-2}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-657053005765}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# SSM Parameter definitions
declare -A SSM_PARAMS=(
    # API Parameters
    ["/repostly/api/MONGODB_URI"]="MongoDB connection string"
    ["/repostly/api/CLERK_SECRET_KEY"]="Clerk authentication secret key"
    ["/repostly/api/CLERK_PUBLISHABLE_KEY"]="Clerk publishable key"
    ["/repostly/api/CLERK_ISSUER_URL"]="Clerk issuer URL"
    ["/repostly/api/STRIPE_SECRET_KEY"]="Stripe secret key"
    ["/repostly/api/STRIPE_WEBHOOK_SECRET"]="Stripe webhook secret"
    ["/repostly/api/STRIPE_STARTER_MONTHLY_PRICE_ID"]="Stripe starter monthly price ID"
    ["/repostly/api/STRIPE_STARTER_YEARLY_PRICE_ID"]="Stripe starter yearly price ID"
    ["/repostly/api/STRIPE_CREATOR_MONTHLY_PRICE_ID"]="Stripe creator monthly price ID"
    ["/repostly/api/STRIPE_CREATOR_YEARLY_PRICE_ID"]="Stripe creator yearly price ID"
    ["/repostly/api/STRIPE_PRO_MONTHLY_PRICE_ID"]="Stripe pro monthly price ID"
    ["/repostly/api/STRIPE_PRO_YEARLY_PRICE_ID"]="Stripe pro yearly price ID"
    ["/repostly/api/FRONTEND_URL"]="Frontend application URL"
    ["/repostly/api/APP_URL"]="Application base URL"
    ["/repostly/api/STATE_HMAC_SECRET"]="OAuth state HMAC secret"
    
    # AI Parameters
    ["/repostly/ai/OPENAI_API_KEY"]="OpenAI API key for AI services"
)

update_parameter() {
    local param_name="$1"
    local description="$2"
    local current_value
    
    log "Checking parameter: $param_name"
    
    # Check if parameter exists
    if aws ssm get-parameter --name "$param_name" --with-decryption >/dev/null 2>&1; then
        current_value=$(aws ssm get-parameter --name "$param_name" --with-decryption --query 'Parameter.Value' --output text)
        warning "Parameter exists: ${current_value:0:20}..."
        echo -n "Do you want to update it? (y/n): "
        read -r update_confirm
        if [[ $update_confirm != "y" && $update_confirm != "Y" ]]; then
            success "Skipped: $param_name"
            return 0
        fi
    fi
    
    # Get new value
    echo -n "Enter new value for $description: "
    read -rs new_value
    echo ""
    
    if [[ -z "$new_value" ]]; then
        error "No value provided for $param_name"
        return 1
    fi
    
    # Update parameter
    aws ssm put-parameter \
        --name "$param_name" \
        --value "$new_value" \
        --type "SecureString" \
        --description "$description" \
        --overwrite >/dev/null
    
    success "Updated: $param_name"
}

list_parameters() {
    log "Current SSM Parameters:"
    echo "======================"
    
    for param_name in "${!SSM_PARAMS[@]}"; do
        if aws ssm get-parameter --name "$param_name" --with-decryption >/dev/null 2>&1; then
            version=$(aws ssm get-parameter --name "$param_name" --query 'Parameter.Version' --output text)
            success "✅ $param_name (v$version)"
        else
            warning "❌ $param_name (missing)"
        fi
    done
}

test_parameters() {
    log "Testing SSM parameter access..."
    
    # Test a few key parameters
    local test_params=(
        "/repostly/ai/OPENAI_API_KEY"
        "/repostly/api/MONGODB_URI"
        "/repostly/api/CLERK_SECRET_KEY"
    )
    
    for param in "${test_params[@]}"; do
        if aws ssm get-parameter --name "$param" --with-decryption >/dev/null 2>&1; then
            success "✅ $param accessible"
        else
            error "❌ $param not accessible"
        fi
    done
}

validate_stripe_params() {
    log "Validating Stripe price ID parameters..."
    
    local stripe_params=(
        "/repostly/api/STRIPE_STARTER_MONTHLY_PRICE_ID"
        "/repostly/api/STRIPE_STARTER_YEARLY_PRICE_ID"
        "/repostly/api/STRIPE_CREATOR_MONTHLY_PRICE_ID"
        "/repostly/api/STRIPE_CREATOR_YEARLY_PRICE_ID"
    )
    
    local missing_count=0
    
    for param in "${stripe_params[@]}"; do
        if aws ssm get-parameter --name "$param" --with-decryption >/dev/null 2>&1; then
            local value=$(aws ssm get-parameter --name "$param" --with-decryption --query 'Parameter.Value' --output text)
            if [[ $value == price_* ]]; then
                success "✅ $param: ${value:0:20}..."
            else
                warning "⚠️  $param: Invalid format (should start with 'price_')"
                ((missing_count++))
            fi
        else
            error "❌ $param: Missing"
            ((missing_count++))
        fi
    done
    
    if [ $missing_count -eq 0 ]; then
        success "All Stripe price IDs are properly configured"
        return 0
    else
        error "$missing_count Stripe price ID(s) missing or invalid"
        warning "Run: $0 update to configure missing parameters"
        return 1
    fi
}

show_help() {
    echo "SSM Parameter Management Tool"
    echo "============================"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  list           - List all current SSM parameters"
    echo "  update         - Update SSM parameters interactively"
    echo "  test           - Test SSM parameter access"
    echo "  validate-stripe - Validate Stripe price ID parameters"
    echo "  deploy         - Update parameters and deploy"
    echo "  help           - Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  AWS_REGION     - AWS region (default: us-west-2)"
    echo "  AWS_ACCOUNT_ID - AWS account ID (default: 657053005765)"
}

main() {
    case "${1:-help}" in
        "list")
            list_parameters
            ;;
        "update")
            echo "Updating SSM Parameters..."
            echo "=========================="
            for param_name in "${!SSM_PARAMS[@]}"; do
                update_parameter "$param_name" "${SSM_PARAMS[$param_name]}"
            done
            ;;
        "test")
            test_parameters
            ;;
        "validate-stripe")
            validate_stripe_params
            ;;
        "deploy")
            log "Updating parameters and deploying..."
            for param_name in "${!SSM_PARAMS[@]}"; do
                if [[ $param_name == "/repostly/ai/OPENAI_API_KEY" ]]; then
                    echo -n "Enter OpenAI API key: "
                    read -rs openai_key
                    aws ssm put-parameter \
                        --name "$param_name" \
                        --value "$openai_key" \
                        --type "SecureString" \
                        --overwrite >/dev/null
                    success "Updated OpenAI API key"
                fi
            done
            log "Deploying application..."
            AWS_ACCOUNT_ID="$AWS_ACCOUNT_ID" AWS_REGION="$AWS_REGION" ./scripts/deploy-single-container.sh
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

main "$@"
