#!/bin/bash
set -euo pipefail

# AWS Credentials Setup Script for RealDoc Deployment
# This script helps configure AWS credentials for deployment

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
step() { echo -e "${CYAN}📋 $1${NC}"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AWS Credentials Setup for RealDoc Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &>/dev/null; then
    error "AWS CLI is not installed"
    echo ""
    log "Install AWS CLI:"
    echo "  macOS:   brew install awscli"
    echo "  Linux:   pip install awscli"
    echo "  Windows: Download from https://aws.amazon.com/cli/"
    exit 1
fi

success "AWS CLI is installed"

# Check if already configured
if [ -f ~/.aws/credentials ] && [ -f ~/.aws/config ]; then
    log "AWS credentials file found"
    read -p "Do you want to reconfigure? (yes/no): " reconfigure
    if [ "$reconfigure" != "yes" ]; then
        log "Testing existing credentials..."
        if aws sts get-caller-identity &>/dev/null; then
            AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
            AWS_USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
            success "Credentials are valid"
            log "Account ID: ${AWS_ACCOUNT_ID}"
            log "User/Role: ${AWS_USER_ARN}"
            echo ""
            log "Your AWS credentials are already configured and working!"
            exit 0
        else
            warning "Existing credentials are invalid"
        fi
    fi
fi

echo ""
step "Setting up AWS credentials"
echo ""
log "You'll need:"
echo "  1. AWS Access Key ID"
echo "  2. AWS Secret Access Key"
echo "  3. Default region (e.g., us-east-1, us-west-2)"
echo "  4. Default output format (json recommended)"
echo ""

# Get credentials
read -p "Enter AWS Access Key ID: " AWS_ACCESS_KEY_ID
read -sp "Enter AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
echo ""
read -p "Enter default region [us-east-1]: " AWS_DEFAULT_REGION
AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-1}
read -p "Enter default output format [json]: " AWS_DEFAULT_OUTPUT
AWS_DEFAULT_OUTPUT=${AWS_DEFAULT_OUTPUT:-json}

# Configure AWS CLI
log "Configuring AWS CLI..."
aws configure set aws_access_key_id "$AWS_ACCESS_KEY_ID"
aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY"
aws configure set default.region "$AWS_DEFAULT_REGION"
aws configure set default.output "$AWS_DEFAULT_OUTPUT"

# Verify credentials
step "Verifying credentials..."
if aws sts get-caller-identity &>/dev/null; then
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    AWS_USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    success "Credentials verified successfully!"
    echo ""
    log "Account ID: ${AWS_ACCOUNT_ID}"
    log "User/Role: ${AWS_USER_ARN}"
    log "Region: ${AWS_DEFAULT_REGION}"
    echo ""
    
    # Check Route 53 permissions
    step "Checking Route 53 permissions..."
    if aws route53 list-hosted-zones --max-items 1 &>/dev/null; then
        success "Route 53 access verified"
    else
        warning "Route 53 access check failed"
        echo ""
        log "You may need the following IAM permissions for Route 53:"
        echo "  - route53:CreateHostedZone"
        echo "  - route53:GetHostedZone"
        echo "  - route53:ListHostedZones"
        echo "  - route53:ChangeResourceRecordSets"
        echo "  - route53:GetChange"
        echo ""
        log "And for ACM (SSL certificates):"
        echo "  - acm:RequestCertificate"
        echo "  - acm:DescribeCertificate"
        echo "  - acm:ListCertificates"
        echo ""
    fi
    
    # Check other required permissions
    step "Checking other required permissions..."
    echo ""
    log "Required AWS permissions for full deployment:"
    echo ""
    echo "EC2/VPC:"
    echo "  - ec2:* (for VPC, subnets, security groups)"
    echo ""
    echo "ECS:"
    echo "  - ecs:* (for cluster, services, tasks)"
    echo ""
    echo "ECR:"
    echo "  - ecr:* (for Docker image repositories)"
    echo ""
    echo "ELB:"
    echo "  - elasticloadbalancing:* (for Application Load Balancer)"
    echo ""
    echo "IAM:"
    echo "  - iam:CreateRole, iam:AttachRolePolicy, iam:PassRole"
    echo ""
    echo "CloudWatch:"
    echo "  - logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents"
    echo ""
    echo "Secrets Manager:"
    echo "  - secretsmanager:CreateSecret, secretsmanager:GetSecretValue"
    echo ""
    echo "Route 53:"
    echo "  - route53:* (for DNS management)"
    echo ""
    echo "ACM:"
    echo "  - acm:* (for SSL certificates)"
    echo ""
    
    success "AWS credentials setup complete!"
    echo ""
    log "You can now run: ./deploy-aws.sh"
    
else
    error "Failed to verify credentials"
    echo ""
    log "Please check:"
    echo "  1. Access Key ID is correct"
    echo "  2. Secret Access Key is correct"
    echo "  3. Your IAM user/role has necessary permissions"
    echo "  4. Your AWS account is active"
    exit 1
fi
