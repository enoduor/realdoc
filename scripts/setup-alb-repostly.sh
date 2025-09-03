#!/bin/bash
set -euo pipefail

# Creates/updates ALB rules and target groups for Repostly
# Pass ALB_DNS=<your-alb-dns> to auto-discover ARNs, or set IDs below.

AWS_REGION="us-west-2"
ALB_DNS="${ALB_DNS:-videograb-alb-1069883284.us-west-2.elb.amazonaws.com}"
ALB_ARN="${ALB_ARN:-}"
LISTENER_ARN_HTTPS="${LISTENER_ARN_HTTPS:-}"
VPC_ID="${VPC_ID:-vpc-07cd6eb182e6bae81}"

# No custom domain yet; we'll use path-based routing on the ALB DNS

# Target groups (will be created if missing)
TG_WEB="tg-repostly-frontend"
TG_API="tg-repostly-api"
TG_AI="tg-repostly-ai"

create_tg_if_missing() {
  local name="$1"; local port="$2"; local protocol="HTTP"; local health_path="$3"
  local existing
  existing=$(aws elbv2 describe-target-groups --names "$name" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || true)
  if [ "$existing" = "None" ] || [ -z "$existing" ]; then
    aws elbv2 create-target-group \
      --name "$name" \
      --protocol "$protocol" \
      --port "$port" \
      --vpc-id "$VPC_ID" \
      --target-type ip \
      --health-check-path "$health_path" >/dev/null
    echo "Created TG: $name"
  else
    echo "TG exists: $name"
  fi
}

aws configure set region "$AWS_REGION"

# Auto-discover from ALB DNS if provided
if [ -n "$ALB_DNS" ]; then
  name_guess=$(echo "$ALB_DNS" | cut -d. -f1)
  info=$(aws elbv2 describe-load-balancers --names "$name_guess" --query 'LoadBalancers[0].{arn:LoadBalancerArn,vpc:VpcId,dns:DNSName}' --output json 2>/dev/null || true)
  if [ -z "$info" ] || [ "$info" = "null" ]; then
    # fallback: list and match by DNS
    info=$(aws elbv2 describe-load-balancers --query "LoadBalancers[?DNSName=='$ALB_DNS']|[0].{arn:LoadBalancerArn,vpc:VpcId,dns:DNSName}" --output json 2>/dev/null || true)
  fi
  if [ -n "$info" ] && [ "$info" != "null" ]; then
    ALB_ARN=$(echo "$info" | jq -r '.arn')
    VPC_ID=$(echo "$info" | jq -r '.vpc')
    echo "Discovered ALB_ARN=$ALB_ARN VPC_ID=$VPC_ID"
  fi
fi

if [ -z "${ALB_ARN:-}" ] || [ -z "${VPC_ID:-}" ]; then
  echo "Missing ALB_ARN or VPC_ID. Set ALB_DNS=<dns> or export ALB_ARN/VPC_ID." >&2
  exit 1
fi

if [ -z "${LISTENER_ARN_HTTPS:-}" ]; then
  LISTENER_ARN_HTTPS=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[?Port==`443`].ListenerArn' --output text)
  if [ -z "$LISTENER_ARN_HTTPS" ] || [ "$LISTENER_ARN_HTTPS" = "None" ]; then
    echo "HTTPS listener (443) not found on ALB. Create it first." >&2
    exit 1
  fi
  echo "Discovered LISTENER_ARN_HTTPS=$LISTENER_ARN_HTTPS"
fi

create_tg_if_missing "$TG_WEB" 3000 "/"
create_tg_if_missing "$TG_API" 4001 "/"
create_tg_if_missing "$TG_AI" 5001 "/ping"

TG_WEB_ARN=$(aws elbv2 describe-target-groups --names "$TG_WEB" --query 'TargetGroups[0].TargetGroupArn' --output text)
TG_API_ARN=$(aws elbv2 describe-target-groups --names "$TG_API" --query 'TargetGroups[0].TargetGroupArn' --output text)
TG_AI_ARN=$(aws elbv2 describe-target-groups --names "$TG_AI" --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "Adding path-based listener rules..."
# Frontend under /repostly/* to avoid conflicts with existing apps
aws elbv2 create-rule \
  --listener-arn "$LISTENER_ARN_HTTPS" \
  --priority 10 \
  --conditions Field=path-pattern,Values='/repostly/*' \
  --actions Type=forward,TargetGroupArn="$TG_WEB_ARN" >/dev/null || true

# API under /repostly/api/*
aws elbv2 create-rule \
  --listener-arn "$LISTENER_ARN_HTTPS" \
  --priority 11 \
  --conditions Field=path-pattern,Values='/repostly/api/*' \
  --actions Type=forward,TargetGroupArn="$TG_API_ARN" >/dev/null || true

# AI under /repostly/ai/* (and health at /repostly/ai/ping)
aws elbv2 create-rule \
  --listener-arn "$LISTENER_ARN_HTTPS" \
  --priority 12 \
  --conditions Field=path-pattern,Values='/repostly/ai/*' \
  --actions Type=forward,TargetGroupArn="$TG_AI_ARN" >/dev/null || true

echo "Done. Attach ECS services to TGs via service definitions and deploy tasks."


