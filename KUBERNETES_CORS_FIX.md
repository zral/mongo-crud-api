# Kubernetes CORS Configuration Fix

## Issue Description
The Kubernetes setup had CORS issues preventing the frontend from accessing the API endpoints. The browser would show CORS errors when the React frontend tried to make API calls.

## Root Cause Analysis
1. **Inconsistent API URL Configuration**: Frontend was configured with hardcoded URLs that didn't work across different access methods
2. **Missing CORS Headers**: Some endpoints lacked proper CORS headers
3. **Ingress Configuration**: Missing ingress setup for proper external access

## Changes Made

### 1. Frontend API URL Configuration
**File**: `k8s/deployment.yaml`
- **Before**: `REACT_APP_API_URL: "http://localhost:30080"`
- **After**: `REACT_APP_API_URL: ""` (uses relative paths)

**File**: `frontend/src/services/api.js`
- Added support for relative API URLs when `REACT_APP_API_URL` is empty
- This allows the frontend to work with nginx proxy, ingress, and port-forward setups

### 2. Enhanced CORS Configuration
**File**: `k8s/deployment.yaml`
- Added explicit CORS environment variables to ConfigMap:
  ```yaml
  CORS_ORIGIN: "*"
  CORS_CREDENTIALS: "false"
  ```
- Added CORS headers to nginx `/health` endpoint
- Enhanced ingress configuration with proper CORS annotations

### 3. Ingress Configuration
**File**: `k8s/deployment.yaml`
- Added complete Ingress resource for external access via `crud-api.local`
- Configured CORS annotations for ingress controller
- Added proper path routing for API and frontend

## Access Methods

### Method 1: NodePort (Default)
```bash
# Deploy the application
kubectl apply -f k8s/deployment.yaml

# Access via NodePort (port 30080)
curl http://localhost:30080/health
curl http://localhost:30080/api/management/collections

# Frontend available at: http://localhost:30080
```

### Method 2: Port Forward
```bash
# Forward API port
kubectl port-forward -n mongodb-crud svc/nginx-service 8080:80

# Access via port forward
curl http://localhost:8080/health
curl http://localhost:8080/api/management/collections

# Frontend available at: http://localhost:8080
```

### Method 3: Ingress (Requires ingress-nginx controller)
```bash
# Add to /etc/hosts
echo "127.0.0.1 crud-api.local" | sudo tee -a /etc/hosts

# Access via ingress
curl http://crud-api.local/health
curl http://crud-api.local/api/management/collections

# Frontend available at: http://crud-api.local
```

## Testing CORS Configuration

Use the provided test script to verify CORS configuration:
```bash
./test-kubernetes-cors.sh
```

The script tests:
- Health endpoint accessibility
- CORS preflight requests (OPTIONS)
- API endpoint accessibility with CORS headers
- NodePort and Ingress access methods

## Expected CORS Headers
When working correctly, API responses should include:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization
```

## Benefits of This Fix
1. **Universal Compatibility**: Frontend works with NodePort, port-forward, and ingress access
2. **Proper CORS Support**: All endpoints include necessary CORS headers
3. **Production Ready**: Ingress configuration for external access
4. **Easy Testing**: Test script to verify CORS configuration
5. **Flexible Deployment**: Supports both simple (NodePort) and advanced (Ingress) deployments