#!/bin/bash
set -euo pipefail

# Unified deploy for Repostly: frontend | api | ai | all
# Usage:
#   AWS_ACCOUNT_ID=657053005765 ./scripts/deploy-repostly.sh frontend
#   AWS_ACCOUNT_ID=657053005765 ./scripts/deploy-repostly.sh api
#   AWS_ACCOUNT_ID=657053005765 ./scripts/deploy-repostly.sh ai
#   AWS_ACCOUNT_ID=657053005765 ./scripts/deploy-repostly.sh all

AWS_REGION="us-west-2"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-657053005765}"

CLUSTER="repostly-cluster"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Inline shared helpers (previously in deploy-repostly-common.sh)
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Required command missing: $1"; exit 1; }
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Missing required env: $name"
    exit 1
  fi
}

login_ecr() {
  require_env AWS_REGION
  require_env AWS_ACCOUNT_ID
  local uri="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$uri"
}

ensure_ecr_repo() {
  local repo="$1"
  aws ecr describe-repositories --repository-names "$repo" >/dev/null 2>&1 || {
    aws ecr create-repository --repository-name "$repo" >/dev/null
  }
}

build_and_push_image() {
  # Args: REPO_NAME, IMAGE_TAG, DOCKERFILE, CONTEXT
  local repo_name="$1"; shift
  local image_tag="$1"; shift
  local dockerfile="$1"; shift
  local context="$1"; shift

  require_env AWS_REGION
  require_env AWS_ACCOUNT_ID

  local ecr_uri="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$repo_name"
  local full_image_uri="$ecr_uri:$image_tag"

  echo "[Build] $full_image_uri"
  docker build -f "$dockerfile" -t "$repo_name:$image_tag" "$context"
  docker tag "$repo_name:$image_tag" "$full_image_uri"
  docker push "$full_image_uri"
  echo "$full_image_uri"
}

register_new_task_def() {
  # Args: TASK_FAMILY, CONTAINER_NAME, NEW_IMAGE
  local task_family="$1"; shift
  local container_name="$1"; shift
  local new_image="$1"; shift

  echo "[Task] family=$task_family container=$container_name image=$new_image"
  local current_json
  current_json=$(aws ecs describe-task-definition --task-definition "$task_family" --query 'taskDefinition' --output json)

  # Update image for the first matching container name
  local new_json
  new_json=$(jq \
    --arg IMAGE "$new_image" \
    --arg NAME "$container_name" \
    'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) \
     | .containerDefinitions = (.containerDefinitions | map(if .name == $NAME then (.image = $IMAGE) else . end))' \
    <<<"$current_json")

  aws ecs register-task-definition --cli-input-json "$new_json" --query 'taskDefinition.taskDefinitionArn' --output text
}

update_service() {
  # Args: CLUSTER_NAME, SERVICE_NAME, TASK_FAMILY
  local cluster_name="$1"; shift
  local service_name="$1"; shift
  local task_family="$1"; shift
  aws ecs update-service --cluster "$cluster_name" --service "$service_name" --task-definition "$task_family" --force-new-deployment >/dev/null
}

generate_tag() {
  local hash
  hash=$(git rev-parse --short HEAD 2>/dev/null || echo local)
  date +"v-%Y%m%d%H%M-$hash"
}

require_cmd aws; require_cmd jq; require_cmd docker; require_cmd git
export AWS_REGION AWS_ACCOUNT_ID

deploy_one() {
  local svc="$1"
  case "$svc" in
    frontend)
      local repo="repostly-frontend"; local task="repostly-frontend"; local container="repostly-frontend"
      local dockerfile="docker/Dockerfile.frontend"; local context="."
      ;;
    api)
      local repo="repostly-api"; local task="repostly-api"; local container="repostly-api"
      local dockerfile="docker/Dockerfile.api"; local context="."
      ;;
    ai)
      local repo="repostly-ai"; local task="repostly-ai"; local container="repostly-ai"
      local dockerfile="docker/Dockerfile.ai"; local context="."
      ;;
    *) echo "Unknown service: $svc (expected: frontend|api|ai)"; exit 1;;
  esac

  echo "[Deploy] $svc"
  login_ecr
  ensure_ecr_repo "$repo"
  local tag; tag="$(generate_tag)"
  local image_uri; image_uri="$(build_and_push_image "$repo" "$tag" "$dockerfile" "$context")"

  local td_arn; td_arn="$(register_new_task_def "$task" "$container" "$image_uri")"
  echo "Registered: $td_arn"
  update_service "$CLUSTER" "$task" "$task"
  echo "[OK] $svc → $image_uri"
}

main() {
  local target="${1:-all}"
  case "$target" in
    frontend|api|ai)
      deploy_one "$target";;
    all)
      deploy_one frontend
      deploy_one api
      deploy_one ai
      ;;
    *)
      echo "Usage: $0 {frontend|api|ai|all}"; exit 1;;
  esac
}

main "$@"


