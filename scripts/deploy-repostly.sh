#!/bin/bash
set -euo pipefail

# Usage:
#   AWS_ACCOUNT_ID=657053005765 AWS_REGION=us-west-2 ./scripts/deploy-repostly.sh all
#   ./scripts/deploy-repostly.sh frontend|api|ai
#
# Requirements: aws, jq, docker (with buildx), optionally git

AWS_REGION="${AWS_REGION:-us-west-2}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-657053005765}"
CLUSTER="repostly-cluster"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Production URLs (replace with your actual domain when you have one)
ALB_DNS="${ALB_DNS:-videograb-alb-1069883284.us-west-2.elb.amazonaws.com}"
PRODUCTION_BASE_URL="https://${ALB_DNS}"

# Set production environment variables for frontend build
export REACT_APP_API_URL="${REACT_APP_API_URL:-${PRODUCTION_BASE_URL}/repostly/api}"
export REACT_APP_PYTHON_API_URL="${REACT_APP_PYTHON_API_URL:-${PRODUCTION_BASE_URL}/repostly/ai}"
export REACT_APP_CLERK_PUBLISHABLE_KEY="${REACT_APP_CLERK_PUBLISHABLE_KEY:-pk_test_YW1hemVkLWdyb3VzZS03NS5jbGVyay5hY2NvdW50cy5kZXYk}"

# Build from the consolidated multi-target Dockerfile
DOCKERFILE="Dockerfile"
BUILD_CONTEXT="."

# Detect host architecture for faster builds
HOST_ARCH=$(docker info --format '{{.OSType}}/{{.Architecture}}' 2>/dev/null || echo "linux/amd64")

# name | repo | task | container | target | platform
SERVICES=("frontend" "repostly-frontend" "repostly-frontend" "repostly-frontend" "frontend" "${PLATFORM_FRONTEND:-$HOST_ARCH}"
          "api"      "repostly-api"      "repostly-api"      "repostly-api"      "api"      "${PLATFORM_API:-$HOST_ARCH}"
          "ai"       "repostly-ai"       "repostly-ai"       "repostly-ai"       "ai"       "${PLATFORM_AI:-$HOST_ARCH}")

require() { command -v "$1" >/dev/null || { echo "Missing: $1"; exit 1; }; }
require aws; require jq; require docker; command -v git >/dev/null || true

login_ecr() {
  aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "$ECR_URI" >/dev/null
}

ensure_repo() {
  local repo="$1"
  aws ecr describe-repositories --repository-names "$repo" --region "$AWS_REGION" >/dev/null 2>&1 \
    || aws ecr create-repository --repository-name "$repo" --region "$AWS_REGION" >/dev/null
}

ensure_log_group() {
  # Args: log group name (e.g., /ecs/repostly-frontend)
  local group="$1"
  # Idempotent create
  if ! aws logs describe-log-groups \
      --log-group-name-prefix "$group" \
      --region "$AWS_REGION" \
      --query "logGroups[?logGroupName==\`$group\`]|length(@)" \
      --output text | grep -q '^1$'; then
    aws logs create-log-group --log-group-name "$group" --region "$AWS_REGION" >/dev/null 2>&1 || true
  fi
  # Set retention (default 14 days)
  aws logs put-retention-policy \
    --log-group-name "$group" \
    --retention-in-days "${LOG_RETENTION_DAYS:-14}" \
    --region "$AWS_REGION" >/dev/null 2>&1 || true
}

# Ensure ALB Target Group health-check settings for a repo (maps to tg-<repo>)
ensure_tg_health() {
  # Args: repo (e.g., repostly-ai) health_path (e.g., /ping)
  local repo="$1"; local health_path="$2"
  local tg_name="tg-$repo"
  local tg_arn

  tg_arn="$(aws elbv2 describe-target-groups \
    --names "$tg_name" \
    --region "$AWS_REGION" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text 2>/dev/null || true)"

  if [ -z "$tg_arn" ] || [ "$tg_arn" = "None" ]; then
    # TG might not be created yet (handled by setup script)
    return 0
  fi

  aws elbv2 modify-target-group \
    --target-group-arn "$tg_arn" \
    --health-check-path "$health_path" \
    --health-check-protocol HTTP \
    --health-check-port traffic-port \
    --matcher HttpCode=200-399 \
    --health-check-interval-seconds "${HC_INTERVAL:-20}" \
    --health-check-timeout-seconds "${HC_TIMEOUT:-10}" \
    --healthy-threshold-count "${HC_HEALTHY_THRESHOLD:-2}" \
    --unhealthy-threshold-count "${HC_UNHEALTHY_THRESHOLD:-3}" \
    --region "$AWS_REGION" >/dev/null 2>&1 || true
}

tag() {
  local ts hash
  ts="$(date +%Y%m%d%H%M%S)"
  hash="$(git rev-parse --short HEAD 2>/dev/null || echo local)"
  echo "v${ts}-${hash}"
}

# Print only the image URI on stdout; send logs to stderr
build_and_push() {
  # Args: repo tag target platform
  local repo="$1"; local _tag="$2"; local target="$3"; local platform="$4"
  local image_tag="$ECR_URI/$repo:$_tag"
  local image_latest="$ECR_URI/$repo:latest"
  local extra_args=""

  # Pass build-time envs for frontend (CRA)
  if [ "$target" = "frontend" ]; then
    if [ -n "${REACT_APP_CLERK_PUBLISHABLE_KEY:-}" ]; then
      extra_args+=" --build-arg REACT_APP_CLERK_PUBLISHABLE_KEY=${REACT_APP_CLERK_PUBLISHABLE_KEY}"
    fi
    # Set production API URLs
    if [ -n "${REACT_APP_API_URL:-}" ]; then
      extra_args+=" --build-arg REACT_APP_API_URL=${REACT_APP_API_URL}"
    fi
    if [ -n "${REACT_APP_PYTHON_API_URL:-}" ]; then
      extra_args+=" --build-arg REACT_APP_PYTHON_API_URL=${REACT_APP_PYTHON_API_URL}"
    fi
  fi

  # Create buildx builder with optimizations
  docker buildx create --use --driver docker-container --driver-opt network=host >/dev/null 2>&1 || true
  export DOCKER_BUILDKIT=1

  >&2 echo "[Buildx] $image_tag (target=$target platform=$platform)"

  # Fast build without cache complications
  docker buildx build \
    --platform "$platform" \
    --target "$target" \
    -f "$DOCKERFILE" \
    -t "$image_tag" \
    -t "$image_latest" \
    $extra_args \
    --push \
    "$BUILD_CONTEXT"

  # stdout: image only (no newline)
  printf "%s" "$image_tag"
}

assert_container_exists() {
  local task="$1" container="$2"
  local n
  n="$(aws ecs describe-task-definition --task-definition "$task" --region "$AWS_REGION" \
        --query "taskDefinition.containerDefinitions[?name=='$container'] | length(@)" --output text)"
  [[ "$n" == "1" ]] || { echo "Container '$container' not found in task '$task'"; exit 1; }
}

assert_taskdef_arn() {
  local v="$1"
  if [[ ! "$v" =~ ^arn:aws:ecs:[a-z0-9-]+:[0-9]{12}:task-definition/.+:[0-9]+$ ]]; then
    echo "ERROR: expected task definition ARN, got: $v" >&2
    exit 1
  fi
}

register_taskdef_with_image() {
  # Args: task container image
  local task="$1"; local container="$2"; local image="$3"

  # sanitize image string (remove CR/LF, non-printables, trim)
  local image_clean
  image_clean="$(
    printf "%s" "$image" \
    | LC_ALL=C tr -d '\r\n' \
    | LC_ALL=C tr -cd '[:print:]' \
    | sed -e 's/^[[:space:]]\+//' -e 's/[[:space:]]\+$//'
  )"

  assert_container_exists "$task" "$container"

  aws ecs describe-task-definition --task-definition "$task" --region "$AWS_REGION" \
    --query 'taskDefinition' --output json > td.json

  # Update only the named container's image
  jq --arg NAME "$container" --arg IMAGE "$image_clean" \
    'del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy,.inferenceAccelerators)
     | .containerDefinitions = (.containerDefinitions | map(if .name == $NAME then (.image=$IMAGE) else . end))' td.json > td-new.json

  # Optional debug:
  # jq -r '.containerDefinitions[] | "NAME=\(.name)  IMAGE=\(.image)"' td-new.json >&2

  aws ecs register-task-definition --region "$AWS_REGION" --cli-input-json file://td-new.json \
    --query 'taskDefinition.taskDefinitionArn' --output text
}

wait_stable() {
  local svc="$1"
  echo "[Wait] $svc stable…"
  aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER" --services "$svc"
  echo "[OK] $svc stable."
}

deploy_one() {
  local name="$1"
  local i
  for ((i=0; i<${#SERVICES[@]}; i+=6)); do
    if [[ "${SERVICES[$i]}" == "$name" ]]; then
      local repo="${SERVICES[$((i+1))]}"
      local task="${SERVICES[$((i+2))]}"
      local container="${SERVICES[$((i+3))]}"
      local target="${SERVICES[$((i+4))]}"
      local platform="${SERVICES[$((i+5))]}"

      # Ensure CloudWatch Logs group exists for this repo (e.g., /ecs/repostly-frontend)
      ensure_log_group "/ecs/$repo"

      # Ensure TG health-check path matches app behavior
      local hc_path="/"
      if [ "$repo" = "repostly-ai" ]; then hc_path="/ping"; fi
      ensure_tg_health "$repo" "$hc_path"

      ensure_repo "$repo"
      local t; t="$(tag)"

      # Build & push; capture stdout only
      local img
      img="$(build_and_push "$repo" "$t" "$target" "$platform")"
      # extra sanitize just in case
      img="$(printf "%s" "$img" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      echo "[Image] $img"

      # Register new task definition; returns ARN
      local td
      td="$(register_taskdef_with_image "$task" "$container" "$img")"
      echo "[TaskDef] $td"
      assert_taskdef_arn "$td"

      echo "[UPDATE] service=$task taskDef=$td"
      aws ecs update-service \
        --cluster "$CLUSTER" \
        --service "$task" \
        --task-definition "$td" \
        --region "$AWS_REGION" \
        --force-new-deployment >/dev/null

      wait_stable "$task"
      return 0
    fi
  done
  echo "Unknown service: $name"; exit 1
}

main() {
  echo "[Login] ECR $ECR_URI"
  echo "[URLs] API: $REACT_APP_API_URL"
  echo "[URLs] AI: $REACT_APP_PYTHON_API_URL"
  echo "[URLs] Clerk: ${REACT_APP_CLERK_PUBLISHABLE_KEY:0:20}..."
  login_ecr

  case "${1:-all}" in
    api|ai|frontend) deploy_one "$1" ;;
    all)
      # Recommended order: backend → ai → frontend
      deploy_one api
      deploy_one ai
      deploy_one frontend
      ;;
    *)
      echo "Usage: $0 {frontend|api|ai|all}"; exit 1;;
  esac
}
main "$@"