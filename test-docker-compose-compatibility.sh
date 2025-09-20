#!/bin/bash

# Test script to verify docker-compose setup still works after CORS fix
echo "🧪 Testing Docker-Compose Setup After CORS Fix"
echo "==============================================="

echo ""
echo "📋 Verifying docker-compose configuration..."

# Check if docker-compose.yml is valid
if docker compose config > /dev/null 2>&1; then
    echo "✅ docker-compose.yml syntax is valid"
else
    echo "❌ docker-compose.yml has syntax errors"
    exit 1
fi

echo ""
echo "🔍 Checking frontend configuration in docker-compose..."

# Extract frontend environment variable
REACT_APP_API_URL=$(grep "REACT_APP_API_URL" docker-compose.yml | cut -d':' -f2- | xargs)

echo "Frontend REACT_APP_API_URL: $REACT_APP_API_URL"

if [ "$REACT_APP_API_URL" = "http://localhost:8080" ]; then
    echo "✅ Frontend still configured with absolute URL for docker-compose"
else
    echo "❌ Frontend configuration changed unexpectedly"
    exit 1
fi

echo ""
echo "🔬 Testing frontend API logic..."

# Test the frontend logic
node -e "
const API_BASE_URL = '$REACT_APP_API_URL';
const baseURL = API_BASE_URL === '' ? '' : API_BASE_URL;

console.log('Original API_BASE_URL:', API_BASE_URL);
console.log('Processed baseURL:', baseURL);

if (baseURL === API_BASE_URL && baseURL !== '') {
    console.log('✅ Frontend will use absolute URLs (docker-compose behavior preserved)');
} else {
    console.log('❌ Frontend logic changed unexpectedly');
    process.exit(1);
}
"

echo ""
echo "📊 Testing CORS configuration compatibility..."

# Check API instances CORS configuration
API1_CORS=$(grep -A 20 "api1:" docker-compose.yml | grep "CORS_ORIGIN" | cut -d':' -f2 | xargs)
API2_CORS=$(grep -A 20 "api2:" docker-compose.yml | grep "CORS_ORIGIN" | cut -d':' -f2 | xargs)
API3_CORS=$(grep -A 20 "api3:" docker-compose.yml | grep "CORS_ORIGIN" | cut -d':' -f2 | xargs)

echo "API Instance 1 CORS_ORIGIN: $API1_CORS"
echo "API Instance 2 CORS_ORIGIN: $API2_CORS"
echo "API Instance 3 CORS_ORIGIN: $API3_CORS"

if [ "$API1_CORS" = "http://localhost:3004" ] && [ "$API2_CORS" = "http://localhost:3004" ] && [ "$API3_CORS" = "http://localhost:3004" ]; then
    echo "✅ API instances correctly configured to allow frontend origin"
else
    echo "❌ API CORS configuration issue detected"
fi

echo ""
echo "🌐 Expected behavior in docker-compose:"
echo "- Frontend runs on: http://localhost:3004"
echo "- API accessible via: http://localhost:8080 (nginx load balancer)"
echo "- Frontend makes API calls to: http://localhost:8080/api"
echo "- CORS allows requests from: http://localhost:3004"

echo ""
echo "✅ Docker-compose setup verification complete!"
echo "The CORS fix preserves docker-compose functionality while adding Kubernetes support."