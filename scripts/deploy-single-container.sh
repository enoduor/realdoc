#!/bin/bash
set -euo pipefail

# Deploy single Repostly container to AWS ECS (Fargate)
# Usage: AWS_ACCOUNT_ID=657053005765 AWS_REGION=us-west-2 ./scripts/deploy-single-container.sh

AWS_REGION="${AWS_REGION:-us-west-2}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-657053005765}"
CLUSTER="repostly-cluster"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
REPO_NAME="repostly-unified"
SERVICE_NAME="repostly-unified"
TASK_FAMILY="repostly-unified"

# Public URLs for the built frontend bundle (root hosting)
DOMAIN="${DOMAIN:-reelpostly.com}"
BASE_URL="https://${DOMAIN}"

# Build-time env (React build)
export REACT_APP_API_URL="${REACT_APP_API_URL:-${BASE_URL}}"
export REACT_APP_PYTHON_API_URL="${REACT_APP_PYTHON_API_URL:-${BASE_URL}/ai}"
# Clerk publishable key is public; safe to embed at build time
export REACT_APP_CLERK_PUBLISHABLE_KEY="${REACT_APP_CLERK_PUBLISHABLE_KEY:-pk_live_Y2xlcmsucmVlbHBvc3RseS5jb20k}"
# We now serve at root, not /repostly
PUBLIC_URL="${PUBLIC_URL:-/}"

# ECS container ports (frontend / node API / python AI)
PORT_WEB=3000
PORT_API=4001
PORT_AI=5001

require() { command -v "$1" >/dev/null || { echo "Missing: $1"; exit 1; }; }
require aws; require jq; require docker

log() { echo -e "$@" >&2; }

retry() {
  local tries=$1; shift
  local delay=$1; shift
  local n=0
  until "$@"; do
    n=$((n+1))
    if [ "$n" -ge "$tries" ]; then return 1; fi
    sleep "$delay"
  done
}

tag() {
  local ts hash
  ts="$(date +%Y%m%d%H%M%S)"
  hash="$(git rev-parse --short HEAD 2>/dev/null || echo local)"
  echo "v${ts}-${hash}"
}

login_ecr() {
  log "[Login] ECR $ECR_URI"
  retry 3 2 \
    bash -c 'aws ecr get-login-password --region "'"$AWS_REGION"'" \
      | docker login --username AWS --password-stdin "'"$ECR_URI"'"'
  log "[Login] ECR login OK"
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
  aws logs put-retention-policy --log-group-name "$group" --retention-in-days 14 --region "$AWS_REGION" >/dev/null 2>&1 || true
}

ensure_builder() {
  # Fresh, robust buildx builder (prevents stuck/EOF states on macOS)
  log "[Buildx] Preparing builder…"
  docker buildx rm -f repostly-builder >/dev/null 2>&1 || true
  retry 3 2 docker buildx create --name repostly-builder --use --driver docker-container --driver-opt network=host
  retry 3 2 docker buildx inspect --bootstrap >/dev/null
  log "[Buildx] Builder ready."
}

build_and_push() {
  local tag="$1"
  local img="$ECR_URI/$REPO_NAME:$tag"
  local latest="$ECR_URI/$REPO_NAME:latest"

  log "[Build] Forcing linux/amd64, PUBLIC_URL=${PUBLIC_URL}"
  log "[Build] API: ${REACT_APP_API_URL}"
  log "[Build] AI : ${REACT_APP_PYTHON_API_URL}"
  log "[Build] Clerk key: ${REACT_APP_CLERK_PUBLISHABLE_KEY:0:8}…"

  # Pre-pull bases to smooth Hub hiccups
  docker pull --platform=linux/amd64 node:20-bookworm-slim >/dev/null || true
  docker pull --platform=linux/amd64 node:18-alpine >/dev/null || true

  # Clean, no-cache build; export directly to ECR
  log "[Build] Building and pushing $img"
  DOCKER_BUILDKIT=1 retry 2 3 \
  docker buildx build \
    --platform linux/amd64 \
    --progress=plain \
    --no-cache \
    -f Dockerfile \
    --build-arg REACT_APP_API_URL="$REACT_APP_API_URL" \
    --build-arg REACT_APP_PYTHON_API_URL="$REACT_APP_PYTHON_API_URL" \
    --build-arg REACT_APP_CLERK_PUBLISHABLE_KEY="$REACT_APP_CLERK_PUBLISHABLE_KEY" \
    --build-arg PUBLIC_URL="$PUBLIC_URL" \
    -t "$img" \
    -t "$latest" \
    --push \
    .

  # Verify the tag truly exists in ECR
  aws ecr describe-images \
    --repository-name "$REPO_NAME" \
    --region "$AWS_REGION" \
    --image-ids imageTag="$tag" >/dev/null

  echo "$img"
}

register_task_definition() {
  local image="$1"

  # Fetch current TD (or scaffold a minimal one if family not found)
  if ! aws ecs describe-task-definition --task-definition "$TASK_FAMILY" --region "$AWS_REGION" \
       --query 'taskDefinition' >/dev/null 2>&1; then
    cat > td.new.json <<JSON
{
  "family": "$TASK_FAMILY",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskRole",
  "containerDefinitions": [{
    "name": "$REPO_NAME",
    "image": "$image",
    "essential": true,
    "portMappings": [
      {"containerPort": $PORT_WEB, "protocol":"tcp"},
      {"containerPort": $PORT_API, "protocol":"tcp"},
      {"containerPort": $PORT_AI,  "protocol":"tcp"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/$REPO_NAME",
        "awslogs-region": "$AWS_REGION",
        "awslogs-stream-prefix": "ecs"
      }
    },
        "environment": [
          {"name":"NODE_ENV","value":"production"},
          {"name":"PORT","value":"$PORT_API"},
          {"name":"AWS_REGION","value":"$AWS_REGION"},
          {"name":"AWS_BUCKET_NAME","value":"bigvideograb-media"},
          {"name":"AI_ROOT_PATH","value":"/ai"}
        ],
    "secrets": [
      {"name":"MONGODB_URI",      "valueFrom":"arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/MONGODB_URI"},
      {"name":"CLERK_SECRET_KEY", "valueFrom":"arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/CLERK_SECRET_KEY"},
      {"name":"OPENAI_API_KEY",   "valueFrom":"arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/ai/OPENAI_API_KEY"},
      {"name":"STRIPE_SECRET_KEY","valueFrom":"arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/STRIPE_SECRET_KEY"},
      {"name":"FACEBOOK_APP_ID",  "valueFrom":"arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/FACEBOOK_APP_ID"},
      {"name":"FACEBOOK_APP_SECRET","valueFrom":"arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/FACEBOOK_APP_SECRET"},
      {"name":"STATE_HMAC_SECRET","valueFrom":"arn:aws:ssm:$AWS_REGION:$AWS_ACCOUNT_ID:parameter/repostly/api/STATE_HMAC_SECRET"}
    ],
    "healthCheck": {
      "command": ["CMD", "curl", "-fsS", "http://localhost:$PORT_API/health"],
      "interval": 30, "timeout": 10, "retries": 3, "startPeriod": 60
    }
  }]
}
JSON
  else
    aws ecs describe-task-definition \
      --task-definition "$TASK_FAMILY" \
      --region "$AWS_REGION" \
      --query 'taskDefinition' > td.json

    # update container image, environment variables, and secrets; keep roles/limits/ports
    jq --arg NAME "$REPO_NAME" --arg IMG "$image" --arg AWS_REGION "$AWS_REGION" --arg AWS_ACCOUNT_ID "$AWS_ACCOUNT_ID" '
      del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy,.inferenceAccelerators)
      | .containerDefinitions = (.containerDefinitions | map(
          if .name == $NAME then 
            (.image = $IMG) |
                 (.environment = [
                   {"name":"NODE_ENV","value":"production"},
                   {"name":"PORT","value":"4001"},
                   {"name":"AWS_REGION","value":$AWS_REGION},
                   {"name":"AWS_BUCKET_NAME","value":"bigvideograb-media"},
                   {"name":"AI_ROOT_PATH","value":"/ai"}
                 ]) |
                 (.secrets = [
                   {"name":"MONGODB_URI",      "valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/MONGODB_URI")},
                   {"name":"CLERK_SECRET_KEY", "valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/CLERK_SECRET_KEY")},
                   {"name":"CLERK_PUBLISHABLE_KEY", "valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/CLERK_PUBLISHABLE_KEY")},
                   {"name":"OPENAI_API_KEY",   "valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/ai/OPENAI_API_KEY")},
                   {"name":"STRIPE_SECRET_KEY","valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/STRIPE_SECRET_KEY")},
                   {"name":"FACEBOOK_APP_ID",  "valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/FACEBOOK_APP_ID")},
                   {"name":"FACEBOOK_APP_SECRET","valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/FACEBOOK_APP_SECRET")},
                   {"name":"LINKEDIN_CLIENT_ID","valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/LINKEDIN_CLIENT_ID")},
                   {"name":"LINKEDIN_CLIENT_SECRET","valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/LINKEDIN_CLIENT_SECRET")},
                   {"name":"TWITTER_API_KEY","valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/TWITTER_API_KEY")},
                   {"name":"TWITTER_API_SECRET","valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/TWITTER_API_SECRET")},
                   {"name":"GOOGLE_CLIENT_ID","valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/GOOGLE_CLIENT_ID")},
                   {"name":"GOOGLE_CLIENT_SECRET","valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/GOOGLE_CLIENT_SECRET")},
                   {"name":"STATE_HMAC_SECRET","valueFrom":("arn:aws:ssm:" + $AWS_REGION + ":" + $AWS_ACCOUNT_ID + ":parameter/repostly/api/STATE_HMAC_SECRET")}
                 ])
          else . end))
    ' td.json > td.new.json
  fi

  aws ecs register-task-definition \
    --region "$AWS_REGION" \
    --cli-input-json file://td.new.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
}

update_service() {
  local td_arn="$1"

  # If service exists, update TD only (LB config already wired in console)
  if aws ecs describe-services \
      --cluster "$CLUSTER" \
      --services "$SERVICE_NAME" \
      --region "$AWS_REGION" \
      --query 'services[0].serviceName' \
      --output text 2>/dev/null | grep -q "$SERVICE_NAME"; then
    log "[Service] Updating existing service → $td_arn"
    aws ecs update-service \
      --cluster "$CLUSTER" \
      --service "$SERVICE_NAME" \
      --task-definition "$td_arn" \
      --region "$AWS_REGION" \
      --force-new-deployment >/dev/null
  else
    # First-time create: attach to unified TG on port 3000 (frontend)
    log "[Service] Creating service → $td_arn"
    aws ecs create-service \
      --cluster "$CLUSTER" \
      --service-name "$SERVICE_NAME" \
      --task-definition "$td_arn" \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[subnet-0840b774ddc688987,subnet-0113e0c8e2cafde02],securityGroups=[sg-05a357e17fb04284b],assignPublicIp=ENABLED}" \
      --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:$AWS_REGION:$AWS_ACCOUNT_ID:targetgroup/tg-repostly-unified/6ac02528aefcdd85,containerName=$REPO_NAME,containerPort=$PORT_WEB" \
      --region "$AWS_REGION" >/dev/null
  fi
}

wait_stable() {
  log "[Wait] services-stable for $SERVICE_NAME …"
  aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER" --services "$SERVICE_NAME"
  log "[OK] Service stable."
}

preflight() {
  log "[Preflight] Checking Docker daemon…"
  docker info >/dev/null || { log "🚨 Docker daemon not running"; exit 1; }
  log "[Preflight] AWS identity…"
  aws sts get-caller-identity --region "$AWS_REGION" >/dev/null || { log "🚨 AWS creds invalid"; exit 1; }
}

main() {
  preflight
  log "[URLs] API: ${REACT_APP_API_URL}"
  log "[URLs] AI : ${REACT_APP_PYTHON_API_URL}"
  login_ecr
  ensure_repo
  ensure_log_group
  ensure_builder

  local t img td
  t="$(tag)"
  img="$(build_and_push "$t")"
  log "[Image] $img"

  td="$(register_task_definition "$img")"
  log "[TaskDef] $td"

  update_service "$td"
  wait_stable

  log "[Success] Deployment complete"
  log "[Open]  https://${DOMAIN}/"
}

main "$@"