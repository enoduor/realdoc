#!/bin/bash
set -euo pipefail

# RealDoc - Build and Push Docker Images to ECR

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

AWS_REGION="${AWS_REGION:-us-west-2}"
PROJECT_NAME="${PROJECT_NAME:-realdoc}"

# Check AWS credentials
if ! aws sts get-caller-identity --region "${AWS_REGION}" &>/dev/null; then
    error "AWS credentials not configured"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --region "${AWS_REGION}" --query Account --output text)
ECR_BASE_URL="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo ""
log "Building RealDoc images for ${AWS_REGION}"
log "Account: ${AWS_ACCOUNT_ID}"
echo ""

# Create ECR repo if needed
create_ecr_repo() {
    local repo_name="${PROJECT_NAME}-$1"
    if aws ecr describe-repositories --repository-names "${repo_name}" --region "${AWS_REGION}" &>/dev/null; then
        log "ECR repo ${repo_name} exists"
    else
        log "Creating ECR repo: ${repo_name}"
        aws ecr create-repository \
            --repository-name "${repo_name}" \
            --region "${AWS_REGION}" \
            --image-tag-mutability MUTABLE \
            --image-scanning-configuration scanOnPush=true &>/dev/null
        success "ECR repo created"
    fi
}

# Build and push
build_and_push() {
    local service=$1
    local dockerfile=$2
    local repo="${ECR_BASE_URL}/${PROJECT_NAME}-${service}"
    
    log "Building ${service} for linux/amd64..."
    DOCKER_BUILDKIT=1 docker build --platform linux/amd64 --load -f ${dockerfile} -t ${repo}:latest . || { error "Build failed"; exit 1; }
    
    log "Pushing ${service}..."
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_BASE_URL} &>/dev/null
    docker push ${repo}:latest || { error "Push failed"; exit 1; }
    
    success "${service} done"
}

# Main
log "Setting up ECR repositories..."
create_ecr_repo "frontend"
create_ecr_repo "node-backend"
create_ecr_repo "python-backend"

echo ""
log "Building and pushing images..."
build_and_push "frontend" "Dockerfile.frontend"
build_and_push "node-backend" "Dockerfile.node"
build_and_push "python-backend" "Dockerfile.python"

echo ""
success "Build complete"
echo ""
log "ECR Image URLs:"
echo "  ${ECR_BASE_URL}/${PROJECT_NAME}-frontend:latest"
echo "  ${ECR_BASE_URL}/${PROJECT_NAME}-node-backend:latest"
echo "  ${ECR_BASE_URL}/${PROJECT_NAME}-python-backend:latest"
echo ""
