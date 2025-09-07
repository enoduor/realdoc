#!/bin/bash
set -euo pipefail

echo "🐳 Starting Repostly with Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Check environment files
echo "📋 Checking environment files..."

if [ -f back/backend-node/.env ]; then
    echo "✅ Node.js backend .env found"
else
    echo "❌ Node.js backend .env not found"
fi

if [ -f back/backend-python/.env ]; then
    echo "✅ Python backend .env found"
else
    echo "❌ Python backend .env not found"
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Build and start service
echo "🔨 Building and starting container..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Check service health
echo "🔍 Checking service health..."

# Check API service
if curl -f http://localhost:4001/api/health > /dev/null 2>&1; then
    echo "✅ API service is healthy"
else
    echo "❌ API service is not responding"
fi

# Check AI service
if curl -f http://localhost:5001/ping > /dev/null 2>&1; then
    echo "✅ AI service is healthy"
else
    echo "❌ AI service is not responding"
fi

# Check Frontend service
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend service is healthy"
else
    echo "❌ Frontend service is not responding"
fi

echo ""
echo "🚀 Repostly is running with Docker!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 API: http://localhost:4001"
echo "🤖 AI: http://localhost:5001"
echo ""
echo "📋 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"
echo "🧪 To test: ./docker-test.sh"
