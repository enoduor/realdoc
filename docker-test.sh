#!/bin/bash
set -euo pipefail

echo "🧪 Testing Repostly Docker Container..."

# Test AI service
echo "🤖 Testing AI service..."
if curl -f http://localhost:5001/ping > /dev/null 2>&1; then
    echo "✅ AI service is responding"
    
    # Test caption generation
    echo "📝 Testing caption generation..."
    response=$(curl -s -X POST http://localhost:5001/api/v1/captions/ \
        -H "Content-Type: application/json" \
        -d '{"content": "Test Docker caption", "platform": "linkedin", "topic": "technology"}')
    
    if echo "$response" | grep -q "caption"; then
        echo "✅ Caption generation working"
    else
        echo "❌ Caption generation failed"
        echo "Response: $response"
    fi
else
    echo "❌ AI service is not responding"
fi

# Test API service
echo "🔧 Testing API service..."
if curl -f http://localhost:4001/api/health > /dev/null 2>&1; then
    echo "✅ API service is responding"
    
    # Test API proxy to AI
    echo "🔄 Testing API proxy to AI..."
    response=$(curl -s -X POST http://localhost:4001/repostly/ai/api/v1/captions/ \
        -H "Content-Type: application/json" \
        -d '{"content": "Test API proxy", "platform": "linkedin", "topic": "technology"}')
    
    if echo "$response" | grep -q "caption"; then
        echo "✅ API proxy working"
    else
        echo "❌ API proxy failed"
        echo "Response: $response"
    fi
else
    echo "❌ API service is not responding"
fi

# Test Frontend
echo "📱 Testing Frontend..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is responding"
else
    echo "❌ Frontend is not responding"
fi

echo ""
echo "🎉 Docker container testing complete!"
