#!/bin/bash

# Test script for Kubernetes CORS configuration
echo "🧪 Testing Kubernetes CORS Configuration"
echo "=========================================="

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if the namespace exists
if ! kubectl get namespace mongodb-crud &> /dev/null; then
    echo "⚠️  Namespace 'mongodb-crud' not found."
    echo "Please deploy the application first with: kubectl apply -f k8s/deployment.yaml"
    exit 1
fi

echo "📋 Checking pod status..."
kubectl get pods -n mongodb-crud

echo ""
echo "🔍 Checking services..."
kubectl get services -n mongodb-crud

echo ""
echo "🌐 Testing CORS configuration via NodePort..."

# Get the NodePort for nginx service
NODEPORT=$(kubectl get service nginx-service -n mongodb-crud -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null)

if [ -z "$NODEPORT" ]; then
    echo "❌ Could not find nginx service NodePort"
    exit 1
fi

echo "📡 Testing API access via localhost:$NODEPORT"

# Test health endpoint
echo ""
echo "🏥 Testing health endpoint..."
curl -i -X GET "http://localhost:$NODEPORT/health" || echo "❌ Health endpoint failed"

echo ""
echo "🔧 Testing CORS preflight (OPTIONS request)..."
curl -i -X OPTIONS "http://localhost:$NODEPORT/api/management/collections" \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Content-Type" || echo "❌ CORS preflight failed"

echo ""
echo "📊 Testing API endpoint with CORS headers..."
curl -i -X GET "http://localhost:$NODEPORT/api/management/collections" \
    -H "Origin: http://localhost:3000" || echo "❌ API endpoint failed"

echo ""
echo "🎯 Testing with Ingress (if configured)..."
echo "Add this to /etc/hosts for local testing:"
echo "127.0.0.1 crud-api.local"
echo ""
echo "Then test with: curl -H 'Host: crud-api.local' http://localhost/health"

echo ""
echo "✅ CORS test completed. Check the responses above for CORS headers:"
echo "   - Access-Control-Allow-Origin: *"
echo "   - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS"  
echo "   - Access-Control-Allow-Headers: (various headers)"