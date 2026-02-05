#!/bin/bash
set -euo pipefail

# RealDoc - Complete Production Deployment Script
# Combines: secret sync, infrastructure, Docker builds, and ECS updates
#
# Usage:
#   ./deploy.sh                    # Full deployment
#   ./deploy.sh --secrets-only     # Only sync secrets
#   ./deploy.sh --infra-only       # Only apply Terraform
#   ./deploy.sh --build-only       # Only build/push Docker images
#   ./deploy.sh --update-only      # Only update ECS services

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
PROJECT_NAME="${PROJECT_NAME:-realdoc}"
CLUSTER="${CLUSTER:-realdoc-cluster}"
TERRAFORM_DIR="deployment/terraform"

# Parse arguments
SECRETS_ONLY=false
INFRA_ONLY=false
BUILD_ONLY=false
UPDATE_ONLY=false

for arg in "$@"; do
    case $arg in
        --secrets-only) SECRETS_ONLY=true ;;
        --infra-only) INFRA_ONLY=true ;;
        --build-only) BUILD_ONLY=true ;;
        --update-only) UPDATE_ONLY=true ;;
        *) ;;
    esac
done

# If no specific flag, do full deployment
if [ "$SECRETS_ONLY" = false ] && [ "$INFRA_ONLY" = false ] && [ "$BUILD_ONLY" = false ] && [ "$UPDATE_ONLY" = false ]; then
    SECRETS_ONLY=false
    INFRA_ONLY=false
    BUILD_ONLY=false
    UPDATE_ONLY=false
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RealDoc - Production Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check AWS credentials
if ! aws sts get-caller-identity --region "${AWS_REGION}" &>/dev/null; then
    error "AWS credentials not configured"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --region "${AWS_REGION}" --query Account --output text)
ECR_BASE_URL="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Check for required tools
if ! command -v jq &> /dev/null; then
    error "jq is required but not installed. Please install jq: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

log "Region: ${AWS_REGION} | Account: ${AWS_ACCOUNT_ID} | Cluster: ${CLUSTER}"
echo ""

# Function: Sync CLERK_PUBLISHABLE_KEY from SSM to Secrets Manager
sync_clerk_key() {
    log "Syncing CLERK_PUBLISHABLE_KEY from SSM to Secrets Manager..."
    CLERK_PUB_KEY=$(aws ssm get-parameter --name "/repostly/api/CLERK_PUBLISHABLE_KEY" --region "${AWS_REGION}" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || echo "")
    
    if [ -z "$CLERK_PUB_KEY" ] || [ "$CLERK_PUB_KEY" = "None" ]; then
        warning "Could not retrieve CLERK_PUBLISHABLE_KEY from SSM"
        warning "Continuing deployment - ensure secret is set manually if needed"
        return 0  # Don't fail deployment, just warn
    fi
    
    log "Retrieved CLERK_PUBLISHABLE_KEY (length: ${#CLERK_PUB_KEY})"
    log "Setting in Secrets Manager..."
    
    if aws secretsmanager create-secret \
        --name "${PROJECT_NAME}/clerk-publishable-key" \
        --secret-string "$CLERK_PUB_KEY" \
        --region "${AWS_REGION}" 2>/dev/null; then
        success "Secret created"
    elif aws secretsmanager update-secret \
        --secret-id "${PROJECT_NAME}/clerk-publishable-key" \
        --secret-string "$CLERK_PUB_KEY" \
        --region "${AWS_REGION}" 2>/dev/null; then
        success "Secret updated"
    else
        error "Failed to sync CLERK_PUBLISHABLE_KEY to Secrets Manager"
        return 1
    fi
    
    success "CLERK_PUBLISHABLE_KEY synced"
    return 0
}

# Function: Apply Terraform infrastructure
deploy_infrastructure() {
    log "Deploying infrastructure with Terraform..."
    
    # Check for Terraform
    if ! command -v terraform &> /dev/null; then
        error "Terraform not found. Please install Terraform:"
        if [[ "$OSTYPE" == "darwin"* ]] && command -v brew &> /dev/null; then
            echo "  brew install terraform"
        else
            echo "  Visit: https://www.terraform.io/downloads"
        fi
        exit 1
    fi
    
    TERRAFORM_VERSION=$(terraform version -json 2>/dev/null | grep -o '"terraform_version":"[^"]*' | cut -d'"' -f4 || echo "unknown")
    log "Terraform version: ${TERRAFORM_VERSION}"
    echo ""
    
    # Check if terraform.tfvars exists (production: fail if missing, don't prompt)
    if [ ! -f "${TERRAFORM_DIR}/terraform.tfvars" ]; then
        error "terraform.tfvars not found. Required for production deployment."
        error "Please create it from ${TERRAFORM_DIR}/terraform.tfvars.example"
        exit 1
    fi
    
    # Navigate to Terraform directory
    cd "${TERRAFORM_DIR}"
    
    # Initialize Terraform (silent for production)
    log "Initializing Terraform..."
    terraform init -upgrade >/dev/null 2>&1 || {
        error "Terraform init failed"
        cd ../..
        exit 1
    }
    
    # Apply Terraform (auto-approve for production)
    log "Applying infrastructure changes (auto-approve)..."
    terraform apply -auto-approve || {
        error "Terraform apply failed"
        cd ../..
        exit 1
    }
    
    cd ../..
    success "Infrastructure deployed"
    return 0
}

# Function: Create ECR repository if needed
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

# Function: Build and push Docker image
build_and_push() {
    local service=$1
    local dockerfile=$2
    local repo="${ECR_BASE_URL}/${PROJECT_NAME}-${service}"
    
    log "Building ${service} for linux/amd64..."
    DOCKER_BUILDKIT=1 docker build --platform linux/amd64 --load -f ${dockerfile} -t ${repo}:latest . || {
        error "Build failed for ${service}"
        return 1
    }
    
    log "Pushing ${service}..."
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_BASE_URL} &>/dev/null
    docker push ${repo}:latest || { error "Push failed"; exit 1; }
    
    success "${service} done"
}

# Function: Build and push all Docker images
build_and_push_images() {
    log "Building and pushing Docker images..."
    echo ""
    
    log "Setting up ECR repositories..."
    create_ecr_repo "frontend"
    create_ecr_repo "node-backend"
    create_ecr_repo "python-backend"
    echo ""
    
    log "Building and pushing images..."
    
    # Get Clerk publishable key for frontend build
    log "Retrieving Clerk publishable key for frontend build..."
    CLERK_PUB_KEY=$(aws ssm get-parameter --name "/repostly/api/CLERK_PUBLISHABLE_KEY" --region "${AWS_REGION}" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || echo "")
    
    if [ -z "$CLERK_PUB_KEY" ]; then
        warning "Could not retrieve CLERK_PUBLISHABLE_KEY from SSM, building frontend without it"
        build_and_push "frontend" "Dockerfile.frontend"
    else
        log "Building frontend with Clerk key..."
        local repo="${ECR_BASE_URL}/${PROJECT_NAME}-frontend"
        DOCKER_BUILDKIT=1 docker build --platform linux/amd64 --load \
            --build-arg REACT_APP_CLERK_PUBLISHABLE_KEY="${CLERK_PUB_KEY}" \
            -f Dockerfile.frontend -t ${repo}:latest . || {
            error "Frontend build failed"
            return 1
        }
        log "Pushing frontend..."
        aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_BASE_URL} &>/dev/null
        docker push ${repo}:latest || { error "Frontend push failed"; exit 1; }
        success "frontend done"
    fi
    
    build_and_push "node-backend" "Dockerfile.node"
    build_and_push "python-backend" "Dockerfile.python"
    
    echo ""
    success "All images built and pushed"
    log "ECR Image URLs:"
    echo "  ${ECR_BASE_URL}/${PROJECT_NAME}-frontend:latest"
    echo "  ${ECR_BASE_URL}/${PROJECT_NAME}-node-backend:latest"
    echo "  ${ECR_BASE_URL}/${PROJECT_NAME}-python-backend:latest"
    return 0
}

# Function: Wait for ECS service to be stable
wait_for_service_stable() {
    local SERVICE=$1
    local MAX_WAIT=${2:-600}  # Default 10 minutes
    local INTERVAL=10
    local ELAPSED=0
    
    log "Waiting for ${SERVICE} to be stable..."
    
    while [ $ELAPSED -lt $MAX_WAIT ]; do
        # Get service status
        local SERVICE_STATUS=$(aws ecs describe-services \
            --cluster "${CLUSTER}" \
            --services "${SERVICE}" \
            --region "${AWS_REGION}" \
            --query 'services[0]' \
            --output json 2>/dev/null)
        
        if [ -z "$SERVICE_STATUS" ] || [ "$SERVICE_STATUS" = "null" ]; then
            warning "${SERVICE} not found, skipping..."
            return 1
        fi
        
        # Check if service is stable
        local RUNNING_COUNT=$(echo "$SERVICE_STATUS" | jq -r '.runningCount // 0')
        local DESIRED_COUNT=$(echo "$SERVICE_STATUS" | jq -r '.desiredCount // 0')
        local DEPLOYMENTS=$(echo "$SERVICE_STATUS" | jq -r '.deployments | length')
        
        # Service is stable when:
        # 1. Running count equals desired count
        # 2. Only one active deployment (old one is drained)
        # 3. All tasks are running and healthy
        if [ "$RUNNING_COUNT" -eq "$DESIRED_COUNT" ] && [ "$DEPLOYMENTS" -eq 1 ]; then
            # Check if all tasks are healthy
            local TASKS=$(aws ecs list-tasks \
                --cluster "${CLUSTER}" \
                --service-name "${SERVICE}" \
                --region "${AWS_REGION}" \
                --desired-status RUNNING \
                --query 'taskArns[]' \
                --output json 2>/dev/null | jq -r '.[]' | head -n ${DESIRED_COUNT})
            
            if [ -z "$TASKS" ] || [ "$TASKS" = "null" ]; then
                echo -n "."
                sleep $INTERVAL
                ELAPSED=$((ELAPSED + INTERVAL))
                continue
            fi
            
            # Check task health status
            local ALL_HEALTHY=true
            for TASK in $TASKS; do
                local TASK_STATUS=$(aws ecs describe-tasks \
                    --cluster "${CLUSTER}" \
                    --tasks "$TASK" \
                    --region "${AWS_REGION}" \
                    --query 'tasks[0]' \
                    --output json 2>/dev/null)
                
                local LAST_STATUS=$(echo "$TASK_STATUS" | jq -r '.lastStatus // "UNKNOWN"')
                local HEALTH_STATUS=$(echo "$TASK_STATUS" | jq -r '.healthStatus // "UNKNOWN"')
                
                if [ "$LAST_STATUS" != "RUNNING" ]; then
                    ALL_HEALTHY=false
                    break
                fi
                
                # If health check is enabled, verify it's healthy
                if [ "$HEALTH_STATUS" != "UNKNOWN" ] && [ "$HEALTH_STATUS" != "HEALTHY" ]; then
                    ALL_HEALTHY=false
                    break
                fi
            done
            
            if [ "$ALL_HEALTHY" = true ]; then
                success "${SERVICE} is stable (${RUNNING_COUNT}/${DESIRED_COUNT} tasks running)"
                return 0
            fi
        fi
        
        echo -n "."
        sleep $INTERVAL
        ELAPSED=$((ELAPSED + INTERVAL))
    done
    
    error "${SERVICE} did not become stable within ${MAX_WAIT} seconds"
    return 1
}

# Function: Update ECS services
update_ecs_services() {
    local WAIT_FOR_STABLE=${1:-true}
    
    log "Updating ECS services..."
    updated=0
    failed=0
    services_to_wait=()
    
    for SERVICE in "${PROJECT_NAME}-node-backend" "${PROJECT_NAME}-python-backend" "${PROJECT_NAME}-frontend"; do
        log "Updating ${SERVICE}..."
        if aws ecs update-service \
            --cluster "${CLUSTER}" \
            --service "${SERVICE}" \
            --force-new-deployment \
            --region "${AWS_REGION}" \
            --query 'service.{ServiceName:serviceName,Status:status,DesiredCount:desiredCount}' \
            --output table &>/dev/null; then
            success "${SERVICE} update initiated"
            updated=$((updated + 1))
            if [ "$WAIT_FOR_STABLE" = true ]; then
                services_to_wait+=("${SERVICE}")
            fi
        else
            warning "${SERVICE} update failed or service doesn't exist"
            failed=$((failed + 1))
        fi
    done
    
    echo ""
    if [ $updated -gt 0 ]; then
        success "${updated} service(s) update initiated"
    fi
    if [ $failed -gt 0 ]; then
        warning "${failed} service(s) failed to update"
    fi
    
    # Wait for services to be stable
    if [ "$WAIT_FOR_STABLE" = true ] && [ ${#services_to_wait[@]} -gt 0 ]; then
        echo ""
        log "Waiting for services to become stable..."
        local all_stable=true
        
        for SERVICE in "${services_to_wait[@]}"; do
            if ! wait_for_service_stable "${SERVICE}"; then
                all_stable=false
            fi
        done
        
        echo ""
        if [ "$all_stable" = true ]; then
            success "All services are stable"
            return 0
        else
            warning "Some services did not become stable"
            return 1
        fi
    fi
    
    return 0
}

# Main execution
if [ "$SECRETS_ONLY" = true ]; then
    sync_clerk_key
elif [ "$INFRA_ONLY" = true ]; then
    deploy_infrastructure
elif [ "$BUILD_ONLY" = true ]; then
    build_and_push_images
elif [ "$UPDATE_ONLY" = true ]; then
    update_ecs_services
else
    # Full production deployment
    log "Starting full production deployment..."
    echo ""
    
    # Step 1: Sync secrets
    sync_clerk_key || warning "Secret sync had issues, continuing..."
    echo ""
    
    # Step 2: Deploy infrastructure
    deploy_infrastructure || {
        error "Infrastructure deployment failed"
        exit 1
    }
    echo ""
    
    # Step 3: Build and push images
    build_and_push_images || {
        error "Docker build/push failed"
        exit 1
    }
    echo ""
    
    # Step 4: Update ECS services and wait for stability
    if update_ecs_services true; then
        echo ""
        # Get access URL from Terraform
        log "Getting deployment URL..."
        cd "${TERRAFORM_DIR}"
        DOMAIN_NAME=$(grep "^domain_name" terraform.tfvars 2>/dev/null | cut -d'"' -f2 || echo "app.reelpostly.com")
        cd ../..
        
        ACCESS_URL="https://${DOMAIN_NAME}"
        
        success "Deployment complete! All services are stable and running."
    else
        error "Deployment completed but some services are not stable"
        exit 1
    fi
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    success "🌐 Your application is available at:"
    echo ""
    echo "   ${ACCESS_URL}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    log "Monitor deployment status:"
    echo "  aws ecs describe-services --cluster ${CLUSTER} --services ${PROJECT_NAME}-node-backend ${PROJECT_NAME}-python-backend ${PROJECT_NAME}-frontend --region ${AWS_REGION}"
    echo ""
    log "View logs:"
    echo "  aws logs tail /ecs/${PROJECT_NAME}-node-backend --follow --region ${AWS_REGION}"
    echo "  aws logs tail /ecs/${PROJECT_NAME}-python-backend --follow --region ${AWS_REGION}"
    echo ""
fi
