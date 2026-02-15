#!/bin/bash
# Pull SEO-related backend files from the image currently in ECR (what ECS runs).
# Use this to restore seo_helper.py and routes/seo.py after they were reverted.
# Requires: AWS CLI, Docker, same AWS_REGION/PROJECT_NAME as deploy.sh.
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-west-2}"
PROJECT_NAME="${PROJECT_NAME:-realdoc}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if ! aws sts get-caller-identity --region "${AWS_REGION}" &>/dev/null; then
    echo "❌ AWS credentials not configured. Run: aws configure"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --region "${AWS_REGION}" --query Account --output text)
ECR_IMAGE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-python-backend:latest"

echo "ℹ️  Logging into ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "ℹ️  Pulling Python backend image (what ECS runs, linux/amd64)..."
docker pull --platform linux/amd64 "${ECR_IMAGE}"

echo "ℹ️  Copying SEO files from image into repo..."
CID=$(docker create "${ECR_IMAGE}")
trap "docker rm -f ${CID} >/dev/null 2>&1 || true" EXIT

docker cp "${CID}:/app/utils/seo_helper.py" "${REPO_ROOT}/back/backend_python/utils/seo_helper.py"
docker cp "${CID}:/app/routes/seo.py" "${REPO_ROOT}/back/backend_python/routes/seo.py"

echo "✅ Restored back/backend_python/utils/seo_helper.py and back/backend_python/routes/seo.py from ECR image."
echo "   (Frontend SEOGenerator.jsx is not in the image—only built assets. Restore it from backup or re-implement if needed.)"
