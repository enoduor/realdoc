#!/bin/bash
set -euo pipefail

# RealDoc - Deploy Infrastructure to AWS

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

AWS_REGION="${AWS_REGION:-us-west-2}"
TERRAFORM_DIR="deployment/terraform"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RealDoc - Infrastructure Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check AWS credentials
if ! aws sts get-caller-identity --region "${AWS_REGION}" &>/dev/null; then
    error "AWS credentials not configured"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --region "${AWS_REGION}" --query Account --output text)
log "Region: ${AWS_REGION} | Account: ${AWS_ACCOUNT_ID}"
echo ""

# Check for Terraform
if ! command -v terraform &> /dev/null; then
    warning "Terraform not found. Installing..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            log "Installing Terraform via Homebrew..."
            brew install terraform
        else
            error "Homebrew not found. Please install Terraform manually:"
            echo "  brew install terraform"
            echo "  Or download from: https://www.terraform.io/downloads"
            exit 1
        fi
    else
        error "Please install Terraform manually:"
        echo "  Visit: https://www.terraform.io/downloads"
        exit 1
    fi
fi

TERRAFORM_VERSION=$(terraform version -json | grep -o '"terraform_version":"[^"]*' | cut -d'"' -f4)
log "Terraform version: ${TERRAFORM_VERSION}"
echo ""

# Check if terraform.tfvars exists
if [ ! -f "${TERRAFORM_DIR}/terraform.tfvars" ]; then
    if [ -f "${TERRAFORM_DIR}/terraform.tfvars.example" ]; then
        log "Creating terraform.tfvars from example..."
        cp "${TERRAFORM_DIR}/terraform.tfvars.example" "${TERRAFORM_DIR}/terraform.tfvars"
        warning "Please review and update ${TERRAFORM_DIR}/terraform.tfvars before continuing"
        echo ""
        read -p "Press Enter to continue with deployment, or Ctrl+C to edit terraform.tfvars first..."
    else
        error "terraform.tfvars not found and no example file available"
        exit 1
    fi
fi

# Navigate to Terraform directory
cd "${TERRAFORM_DIR}"

# Initialize Terraform
log "Initializing Terraform..."
terraform init

echo ""
log "Planning infrastructure changes..."
terraform plan -out=tfplan

echo ""
warning "This will create AWS resources (VPC, ALB, ECS, Route 53, etc.)"
read -p "Do you want to proceed with deployment? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log "Deployment cancelled"
    exit 0
fi

echo ""
log "Applying infrastructure changes..."
terraform apply tfplan

echo ""
success "Infrastructure deployment complete!"
echo ""
log "Your application should be available at:"
DOMAIN=$(terraform output -raw domain_name 2>/dev/null || echo "app.reelpostly.com")
echo "  https://${DOMAIN}"
echo ""
log "Note: DNS propagation and SSL certificate validation may take a few minutes"
echo ""
