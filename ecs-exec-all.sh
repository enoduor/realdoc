#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# ECS Exec across all running tasks in a service (Fargate or EC2 launch types)
#
# Usage:
#   ./ecs-exec-all.sh "ls -la /app"
#   CLUSTER=repostly-cluster SERVICE=repostly-unified ./ecs-exec-all.sh "env"
#
# Optional env vars:
#   AWS_REGION   : defaults to us-west-2
#   CLUSTER      : ECS cluster name (defaults to first cluster if not set)
#   SERVICE      : ECS service name  (defaults to first service in cluster)
#   CONTAINER    : container name in task (if omitted and only one exists, it’s used)
#   PROFILE      : AWS profile (optional)
#   DRY_RUN=1    : just show what would run
# ──────────────────────────────────────────────────────────────────────────────

# --- deps ---------------------------------------------------------------------
need() { command -v "$1" >/dev/null || { echo "Missing dependency: $1" >&2; exit 1; }; }
need aws; need jq

# --- config -------------------------------------------------------------------
AWS_REGION="${AWS_REGION:-us-west-2}"
AWS_ARGS=(--region "$AWS_REGION")
[[ -n "${PROFILE:-}" ]] && AWS_ARGS+=(--profile "$PROFILE")

CMD="${1:-}"
if [[ -z "$CMD" ]]; then
  cat >&2 <<'USAGE'
Usage:
  ./ecs-exec-all.sh "command to run inside each running task's container"

Examples:
  ./ecs-exec-all.sh "ls -la /app"
  CLUSTER=repostly-cluster SERVICE=repostly-unified ./ecs-exec-all.sh "env"

Optional env:
  AWS_REGION (default us-west-2), CLUSTER, SERVICE, CONTAINER, PROFILE, DRY_RUN=1
USAGE
  exit 2
fi

# --- helpers ------------------------------------------------------------------
pick_first_json() {
  # prints first element or empty
  jq -r '.[0] // empty'
}

json_or_die() {
  local msg="$1"
  if ! jq . >/dev/null 2>&1; then
    echo "ERROR: $msg" >&2
    exit 1
  fi
}

say() { echo -e "$*"; }

# --- discover cluster ---------------------------------------------------------
if [[ -z "${CLUSTER:-}" ]]; then
  say "🔎 Finding a cluster in $AWS_REGION…"
  CLUSTER="$(aws "${AWS_ARGS[@]}" ecs list-clusters --query 'clusterArns' --output json \
    | json_or_die "Unable to list clusters" \
    | jq -r 'map(split("/")[ -1 ]) | .[0] // empty')"
  [[ -n "$CLUSTER" ]] || { echo "No ECS clusters found in $AWS_REGION." >&2; exit 1; }
  say "👉 Using CLUSTER=$CLUSTER"
fi

# --- discover service ---------------------------------------------------------
if [[ -z "${SERVICE:-}" ]]; then
  say "🔎 Finding a service in cluster $CLUSTER…"
  SERVICE="$(aws "${AWS_ARGS[@]}" ecs list-services --cluster "$CLUSTER" --query 'serviceArns' --output json \
    | json_or_die "Unable to list services" \
    | jq -r 'map(split("/")[ -1 ]) | .[0] // empty')"
  [[ -n "$SERVICE" ]] || { echo "No ECS services found in cluster $CLUSTER." >&2; exit 1; }
  say "👉 Using SERVICE=$SERVICE"
fi

# --- confirm ECS Exec is enabled ---------------------------------------------
say "🔎 Checking if ECS Exec is enabled on $SERVICE…"
EXEC_ENABLED="$(aws "${AWS_ARGS[@]}" ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --query 'services[0].enableExecuteCommand' --output text 2>/dev/null || echo 'False')"
if [[ "$EXEC_ENABLED" != "True" ]]; then
  cat >&2 <<EOF
❌ ECS Exec is not enabled on service '$SERVICE' in cluster '$CLUSTER'.

Enable it (one-time):
  aws ${AWS_ARGS[*]} ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SERVICE" \
    --enable-execute-command

Also ensure:
  • Task execution role has SSM permissions (AmazonECSTaskExecutionRolePolicy + SSM perms)
  • Your principal can use SSM Session Manager (AmazonSSMFullAccess or scoped equivalent)
  • VPC endpoints for SSM/EC2Messages if tasks have no internet egress

Then rerun this script.
EOF
  exit 1
fi

# --- list running tasks -------------------------------------------------------
say "🔎 Listing RUNNING tasks…"
TASK_ARNS_JSON="$(aws "${AWS_ARGS[@]}" ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" \
  --desired-status RUNNING --query 'taskArns' --output json)"
TASK_COUNT="$(echo "$TASK_ARNS_JSON" | jq 'length')"

if (( TASK_COUNT == 0 )); then
  echo "No RUNNING tasks for service '$SERVICE' in cluster '$CLUSTER'." >&2
  exit 1
fi

say "✅ Found $TASK_COUNT running task(s)."

# --- describe tasks to find container names -----------------------------------
DESCRIBE_JSON="$(aws "${AWS_ARGS[@]}" ecs describe-tasks --cluster "$CLUSTER" \
  --tasks $(echo "$TASK_ARNS_JSON" | jq -r '.[]') --output json)"

# pick default container if not provided
if [[ -z "${CONTAINER:-}" ]]; then
  # Grab the first container name from the first task
  CONTAINER="$(echo "$DESCRIBE_JSON" \
    | jq -r '.tasks[0].containers[0].name // empty')"
  [[ -n "$CONTAINER" ]] || { echo "Could not determine container name; set CONTAINER env var." >&2; exit 1; }
  say "👉 Using CONTAINER=$CONTAINER"
fi

# --- run command on each task -------------------------------------------------
EXIT_CODE=0
i=0
for TASK_ARN in $(echo "$TASK_ARNS_JSON" | jq -r '.[]'); do
  ((i++))
  TASK_ID="${TASK_ARN##*/}"
  say "\n▶️  [$i/$TASK_COUNT] Executing in task $TASK_ID (container: $CONTAINER)…"
  set +e
  if [[ "${DRY_RUN:-}" == "1" ]]; then
    echo "DRY_RUN: aws ${AWS_ARGS[*]} ecs execute-command --cluster \"$CLUSTER\" --task \"$TASK_ID\" --container \"$CONTAINER\" --command \"$CMD\" --interactive"
  else
    aws "${AWS_ARGS[@]}" ecs execute-command \
      --cluster "$CLUSTER" \
      --task "$TASK_ID" \
      --container "$CONTAINER" \
      --command "$CMD" \
      --interactive
  fi
  RC=$?
  set -e
  if (( RC != 0 )); then
    echo "⚠️  Command failed in task $TASK_ID with exit code $RC" >&2
    EXIT_CODE=$RC
  else
    say "✅ Done task $TASK_ID"
  fi
done

exit "$EXIT_CODE"