#!/bin/bash

echo "🚀 Building Repostly (lean production build)..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

ok() { echo -e "${GREEN}[OK]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# Clean build folder
rm -rf build
mkdir -p build/{frontend,backend-node,backend-python}

# ---- FRONTEND ----
echo "📦 Building React frontend..."
cd frontend || fail "frontend dir missing"
npm ci --omit=dev || fail "npm install failed (frontend)"
npm run build || fail "frontend build failed"
cp -r build/* ../build/frontend/
cd .. && ok "Frontend ready"

# ---- NODE BACKEND ----
echo "📦 Preparing Node.js backend..."
cd back/backend-node || fail "backend-node dir missing"
npm ci --omit=dev || fail "npm install failed (backend-node)"

# Copy only required files
mkdir -p ../../build/backend-node
cp -r package*.json src server.js ../../build/backend-node/ 2>/dev/null || true

cd ../.. && ok "Node backend ready"

# ---- PYTHON BACKEND ----
echo "📦 Preparing Python backend..."
cd back/backend-python || fail "backend-python dir missing"
pip install --upgrade pip >/dev/null 2>&1
pip install --no-cache-dir -r requirements.txt || fail "pip install failed"

# Copy only required files
mkdir -p ../../build/backend-python
cp -r main.py app requirements.txt ../../build/backend-python/ 2>/dev/null || true

cd ../.. && ok "Python backend ready"

# ---- ENV TEMPLATE ----
cat > build/.env.production.template << 'EOF'
NODE_ENV=production
PORT=4001
MONGODB_URI=
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
OPENAI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOF
ok ".env.production.template created"

# ---- SUMMARY ----
cat > build/BUILD_SUMMARY.md <<EOF
# Repostly Lean Production Build

Built: $(date)

- ✅ Frontend (optimized React build)
- ✅ Node.js backend (only src + package.json)
- ✅ Python backend (only main.py, app/, requirements.txt)

Excluded:
- ❌ node_modules
- ❌ venv
- ❌ .env
- ❌ tests/, docs/, logs/, *.md

Next steps:
1. Copy .env.production.template → .env.production and fill it
2. Build Docker image:
   docker build -t repostly build/
3. Run:
   docker run -p 3000:3000 -p 4001:4001 -p 5001:5001 repostly
EOF

ok "Build complete → ./build"