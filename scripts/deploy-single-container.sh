#!/bin/bash
set -euo pipefail

# Deploy single Repostly container to AWS ECS
# Usage: AWS_ACCOUNT_ID=657053005765 AWS_REGION=us-west-2 ./scripts/deploy-single-container.sh

AWS_REGION="${AWS_REGION:-us-west-2}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-657053005765}"
CLUSTER="repostly-cluster"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
REPO_NAME="repostly-unified"

# Production URLs (replace with your actual domain when you have one)
ALB_DNS="${ALB_DNS:-repostly-alb-1811247430.us-west-2.elb.amazonaws.com}"
PRODUCTION_BASE_URL="https://${ALB_DNS}"

# Set production environment variables for frontend build
export REACT_APP_API_URL="${REACT_APP_API_URL:-${PRODUCTION_BASE_URL}/api}"
export REACT_APP_PYTHON_API_URL="${REACT_APP_PYTHON_API_URL:-${PRODUCTION_BASE_URL}/ai}"
export REACT_APP_CLERK_PUBLISHABLE_KEY="${REACT_APP_CLERK_PUBLISHABLE_KEY:-pk_live_51RCMFRLPiEjYBNcQYp0Czn3uE51AnrqeUnw3S36BKi5G5Nwj1AU2yXFFvG750PE8VeZHhORAtEVubkMdjUzOCd8A003seIy7Nl}"

require() { command -v "$1" >/dev/null || { echo "Missing: $1"; exit 1; }; }
require aws; require jq; require docker

login_ecr() {
  echo "[Login] Logging into ECR..." >&2
  if ! aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "$ECR_URI"; then
    echo "[ERROR] ECR login failed!" >&2
    exit 1
  fi
  echo "[Login] ECR login successful" >&2
}

ensure_repo() {
  aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" >/dev/null 2>&1 \
    || aws ecr create-repository --repository-name "$REPO_NAME" --region "$AWS_REGION" >/dev/null
}

ensure_log_group() {
  local group="/ecs/$REPO_NAME"
  if ! aws logs describe-log-groups \
      --log-group-name-prefix "$group" \
      --region "$AWS_REGION" \
      --query "logGroups[?logGroupName==\`$group\`]|length(@)" \
      --output text | grep -q '^1$'; then
    aws logs create-log-group --log-group-name "$group" --region "$AWS_REGION" >/dev/null 2>&1 || true
  fi
  aws logs put-retention-policy \
    --log-group-name "$group" \
    --retention-in-days 14 \
    --region "$AWS_REGION" >/dev/null 2>&1 || true
}

tag() {
  local ts hash
  ts="$(date +%Y%m%d%H%M%S)"
  hash="$(git rev-parse --short HEAD 2>/dev/null || echo local)"
  echo "v${ts}-${hash}"
}

build_and_push() {
  local tag="$1"
  local image_tag="$ECR_URI/$REPO_NAME:$tag"
  local image_latest="$ECR_URI/$REPO_NAME:latest"
  
  echo "[Build] Building unified container..." >&2
  docker buildx create --use --driver docker-container --driver-opt network=host >/dev/null 2>&1 || true
  export DOCKER_BUILDKIT=1
  
  echo "[Build] Building with tag: $tag" >&2
  if ! docker buildx build \
    --platform linux/amd64 \
    -f Dockerfile \
    --build-arg REACT_APP_API_URL="$REACT_APP_API_URL" \
    --build-arg REACT_APP_PYTHON_API_URL="$REACT_APP_PYTHON_API_URL" \
    --build-arg REACT_APP_CLERK_PUBLISHABLE_KEY="$REACT_APP_CLERK_PUBLISHABLE_KEY" \
    --build-arg PUBLIC_URL="/" \
    -t "$image_tag" \
    -t "$image_latest" \
    --push \
    .; then
    echo "[ERROR] Docker build failed!" >&2
    exit 1
  fi
  
  echo "[Build] Successfully built and pushed: $image_tag" >&2
  
  # Verify the image exists in ECR
  echo "[Verify] Checking image exists in ECR..." >&2
  if ! aws ecr describe-images \
    --repository-name "$REPO_NAME" \
    --region "$AWS_REGION" \
    --image-ids imageTag="$tag" \
    --query 'imageDetails[0].imageDigest' \
    --output text >/dev/null 2>&1; then
    echo "[ERROR] Image $image_tag not found in ECR after push!" >&2
    exit 1
  fi
  
  echo "[Verify] Image confirmed in ECR: $image_tag" >&2
  echo "$image_tag"
}

create_task_definition() {
  local image="$1"
  local task_def_name="repostly-unified"
  
  cat > task-definition.json << EOF
{
  "family": "$task_def_name",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "repostly-unified",
      "image": "$image",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        },
        {
          "containerPort": 4001,
          "protocol": "tcp"
        },
        {
          "containerPort": 5001,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$REPO_NAME",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "4001"
        }
      ],
      "secrets": [
        {
          "name": "MONGODB_URI",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/MONGODB_URI"
        },
        {
          "name": "CLERK_SECRET_KEY",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/CLERK_SECRET_KEY"
        },
        {
          "name": "CLERK_PUBLISHABLE_KEY",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/CLERK_PUBLISHABLE_KEY"
        },
        {
          "name": "CLERK_ISSUER_URL",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/CLERK_ISSUER_URL"
        },
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/ai/OPENAI_API_KEY"
        },
        {
          "name": "STRIPE_SECRET_KEY",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/STRIPE_SECRET_KEY"
        },
        {
          "name": "STRIPE_WEBHOOK_SECRET",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/STRIPE_WEBHOOK_SECRET"
        },
        {
          "name": "STRIPE_STARTER_MONTHLY_PRICE_ID",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/STRIPE_STARTER_MONTHLY_PRICE_ID"
        },
        {
          "name": "STRIPE_STARTER_YEARLY_PRICE_ID",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/STRIPE_STARTER_YEARLY_PRICE_ID"
        },
        {
          "name": "STRIPE_CREATOR_MONTHLY_PRICE_ID",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/STRIPE_CREATOR_MONTHLY_PRICE_ID"
        },
        {
          "name": "STRIPE_CREATOR_YEARLY_PRICE_ID",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/STRIPE_CREATOR_YEARLY_PRICE_ID"
        },
        {
          "name": "STRIPE_PRO_MONTHLY_PRICE_ID",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/STRIPE_PRO_MONTHLY_PRICE_ID"
        },
        {
          "name": "STRIPE_PRO_YEARLY_PRICE_ID",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/STRIPE_PRO_YEARLY_PRICE_ID"
        }
      ],
      "healthCheck": {
        "command": ["CMD", "curl", "-f", "http://localhost:3000/"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

  aws ecs register-task-definition \
    --region "$AWS_REGION" \
    --cli-input-json file://task-definition.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
}

create_service() {
  local task_def_arn="$1"
  local service_name="repostly-unified"
  
  # Always create a new service for fresh deployment
  echo "[Create] Creating new service for Repostly ALB..."
  aws ecs create-service \
    --cluster "$CLUSTER" \
    --service-name "$service_name" \
    --task-definition "$task_def_arn" \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-0840b774ddc688987,subnet-0113e0c8e2cafde02],securityGroups=[sg-05a357e17fb04284b],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:$AWS_REGION:$AWS_ACCOUNT_ID:targetgroup/repostly-unified-tg/7eb50bb851dc19fc,containerName=repostly-unified,containerPort=3000" \
    --region "$AWS_REGION" >/dev/null
}

main() {
  echo "[Login] ECR $ECR_URI"
  echo "[URLs] API: $REACT_APP_API_URL"
  echo "[URLs] AI: $REACT_APP_PYTHON_API_URL"
  echo "[URLs] Clerk: ${REACT_APP_CLERK_PUBLISHABLE_KEY:0:20}..."
  login_ecr
  
  echo "[Setup] Ensuring ECR repository and log group..."
  ensure_repo
  ensure_log_group
  
  echo "[Build] Building and pushing container..."
  local tag
  tag="$(tag)"
  local image
  image="$(build_and_push "$tag")"
  echo "[Image] $image"
  
  echo "[TaskDef] Creating task definition..."
  local task_def_arn
  task_def_arn="$(create_task_definition "$image")"
  echo "[TaskDef] $task_def_arn"
  
  echo "[Service] Creating/updating service..."
  create_service "$task_def_arn"
  
  echo "[Wait] Waiting for service to stabilize..."
  aws ecs wait services-stable \
    --region "$AWS_REGION" \
    --cluster "$CLUSTER" \
    --services "repostly-unified"
  
  echo "[Success] Deployment complete!"
  echo "[URL] https://your-alb-url/repostly/"
}

main "$@"
