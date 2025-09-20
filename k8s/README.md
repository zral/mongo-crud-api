# Kubernetes Deployment Guide

✅ **Successfully Deployed and Tested** - This deployment has been verified on local Kubernetes cluster.

This guide covers deploying the MongoDB CRUD API with full scalability features in a Kubernetes cluster.

## 🎯 Quick Deployment (Tested Configuration)

```bash
# 1. Build local Docker images
docker build -t mongodb-crud-api:latest .
docker build -t mongodb-crud-frontend:latest ./frontend

# 2. Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml

# 3. Verify deployment
kubectl get pods -n mongodb-crud

# 4. Access the application
kubectl port-forward -n mongodb-crud svc/crud-api-service 8080:80 &
kubectl port-forward -n mongodb-crud svc/frontend-service 3000:3000 &

# 5. Test the deployment
curl http://localhost:8080/health
curl http://localhost:8080/api/cluster/status
```

## ✅ Verified Deployment Status

**All components successfully deployed and tested:**
- **API Pods**: 3/3 running with distributed coordination
- **Frontend**: 1/1 running with React interface  
- **MongoDB**: 1/1 running with authentication (admin/password)
- **Redis**: 1/1 running for distributed locking
- **Services**: All ClusterIP and LoadBalancer services operational
- **HPA**: Auto-scaling configured (2-10 replicas based on CPU/memory)
- **Health Checks**: All readiness and liveness probes working

## Architecture Overview

The deployment includes:
- **MongoDB CRUD API**: Multiple instances with distributed coordination
- **Redis**: For distributed locking and coordination
- **MongoDB**: Database backend
- **Horizontal Pod Autoscaler**: Automatic scaling based on CPU/memory
- **Pod Disruption Budget**: High availability during updates
- **Network Policies**: Security isolation

## Features

### Scalability Features
- ✅ **Distributed Locking**: Prevents duplicate operations across instances
- ✅ **Leader Election**: Ensures single-instance cron job execution
- ✅ **Enhanced Webhook Delivery**: Queue-based processing with Bull
- ✅ **Enhanced Script Execution**: Coordinated execution across instances
- ✅ **Auto-scaling**: HPA scales based on CPU/memory usage
- ✅ **Rolling Updates**: Zero-downtime deployments
- ✅ **Graceful Shutdown**: Leader resignation during pod termination

### Monitoring & Management
- ✅ **Health Checks**: Comprehensive health monitoring
- ✅ **Cluster API**: `/api/cluster/*` endpoints for monitoring
- ✅ **Leadership Management**: View and control leadership
- ✅ **Lock Management**: Monitor distributed locks
- ✅ **Metrics**: Prometheus-compatible metrics endpoint

## Prerequisites

1. **Kubernetes Cluster** (v1.20+)
2. **kubectl** configured for your cluster
3. **Docker** for building images
4. **NGINX Ingress Controller** (optional, for external access)
5. **Metrics Server** (for HPA)

## Deployment Steps

### ✅ Verified Local Deployment

For local Kubernetes clusters (Docker Desktop, minikube, etc.):

```bash
# 1. Build local images (no registry required)
docker build -t mongodb-crud-api:latest .
docker build -t mongodb-crud-frontend:latest ./frontend

# 2. Deploy all resources
kubectl apply -f k8s/deployment.yaml

# 3. Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=mongodb -n mongodb-crud --timeout=60s
kubectl wait --for=condition=ready pod -l app=crud-api -n mongodb-crud --timeout=120s

# 4. Verify all pods are running
kubectl get pods -n mongodb-crud
```

### For Remote/Production Clusters

```bash
# 1. Build and push to registry
docker build -t your-registry/mongodb-crud-api:latest .
docker build -t your-registry/mongodb-crud-frontend:latest ./frontend
docker push your-registry/mongodb-crud-api:latest  
docker push your-registry/mongodb-crud-frontend:latest

# 2. Update image references in k8s/deployment.yaml
# Edit the image names to use your registry

# 3. Deploy to cluster
kubectl apply -f k8s/deployment.yaml
```

### 4. Wait for Services to be Ready

```bash
# Monitor pod startup
kubectl logs -f deployment/crud-api -n mongodb-crud

# Check all components
kubectl get all -n mongodb-crud
```

### 5. Verify Cluster Coordination

```bash
# Get a pod name
POD_NAME=$(kubectl get pods -n mongodb-crud -l app=crud-api -o jsonpath='{.items[0].metadata.name}')

# Check cluster status
kubectl exec -n mongodb-crud $POD_NAME -- curl -s http://localhost:3000/api/cluster/status

# Check leadership
kubectl exec -n mongodb-crud $POD_NAME -- curl -s http://localhost:3000/api/cluster/leadership
```

## Configuration

### Environment Variables

Key configuration options in `ConfigMap`:

```yaml
CLUSTER_ENABLE_DISTRIBUTED_LOCKING: "true"    # Enable Redis coordination
CLUSTER_CRON_LEADER_ELECTION: "true"          # Enable leader election
CLUSTER_SCALING_MAX_INSTANCES: "10"           # Max instances for scaling
WEBHOOKS_ENHANCED_DELIVERY: "true"            # Enable webhook queuing
SCRIPTS_ENABLE_ENHANCED_EXECUTION: "true"     # Enable script coordination
```

### Scaling Configuration

```yaml
# HPA settings
minReplicas: 2      # Minimum instances
maxReplicas: 10     # Maximum instances
targetCPU: 70%      # Scale up at 70% CPU
targetMemory: 80%   # Scale up at 80% memory
```

## ✅ Testing & Verification

### Health Checks (Verified Working)

```bash
# Basic health check
curl http://localhost:8080/health
# Expected: {"status":"healthy","timestamp":"...","mongodb":"connected"}

# Cluster status with multi-instance coordination
curl http://localhost:8080/api/cluster/status | jq
# Expected: Instance details, distributed locking status, database connections

# Management API
curl http://localhost:8080/api/management/collections | jq
# Expected: List of available collections
```

### Troubleshooting - Common Issues Resolved

**CORS Issues (Fixed):**
- ✅ Fixed: Frontend CORS configuration for proper API access
- ✅ Fixed: Added relative API URLs to work with nginx proxy and ingress
- ✅ Fixed: Enhanced CORS headers for all API endpoints including /health
- Solution: Use `./test-kubernetes-cors.sh` to verify CORS configuration

**MongoDB Connection Issues:**
- ✅ Fixed: Updated MongoDB health checks from `mongo` to `mongosh` for v7 compatibility
- ✅ Fixed: Added authentication credentials to connection string
- Solution: MongoDB uses admin/password authentication

**Pod Startup Issues:**
- ✅ Fixed: Used `imagePullPolicy: Never` for local images
- ✅ Fixed: Added proper startup ordering with readiness probes
- Solution: MongoDB must be ready before API pods can connect

**Port Forwarding Access:**
```bash
# API access
kubectl port-forward -n mongodb-crud svc/crud-api-service 8080:80

# Frontend access  
kubectl port-forward -n mongodb-crud svc/frontend-service 3000:3000
```

### Leadership Monitoring

```bash
# Check current leaders
curl http://crud-api.local/api/cluster/leadership

# Force leadership election (if needed)
curl -X POST http://crud-api.local/api/cluster/leadership/force \
  -H "Content-Type: application/json" \
  -d '{"service": "cron"}'
```

### Lock Monitoring

```bash
# List active locks
curl http://crud-api.local/api/cluster/locks

# Cleanup expired locks
curl -X POST http://crud-api.local/api/cluster/locks/cleanup
```

### Metrics

```bash
# Get metrics (Prometheus format)
curl http://crud-api.local/api/cluster/metrics
```

## Scaling Operations

### Manual Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment crud-api --replicas=5 -n mongodb-crud

# Check scaling
kubectl get pods -n mongodb-crud -l app=crud-api
```

### Auto-scaling Status

```bash
# Check HPA status
kubectl get hpa -n mongodb-crud

# Describe HPA for details
kubectl describe hpa crud-api-hpa -n mongodb-crud
```

## Maintenance

### Rolling Updates

```bash
# Update image
kubectl set image deployment/crud-api crud-api=your-registry/crud-api:v2.0.0 -n mongodb-crud

# Monitor rollout
kubectl rollout status deployment/crud-api -n mongodb-crud

# Rollback if needed
kubectl rollout undo deployment/crud-api -n mongodb-crud
```

### Graceful Leadership Transfer

Before taking down the leader instance:

```bash
# Find the leader
LEADER_POD=$(kubectl exec -n mongodb-crud $POD_NAME -- curl -s http://localhost:3000/api/cluster/leadership | jq -r '.leadership.cron.leader')

# Resign leadership gracefully
kubectl exec -n mongodb-crud $LEADER_POD -- curl -X POST http://localhost:3000/api/cluster/leadership/resign \
  -H "Content-Type: application/json" \
  -d '{"service": "cron"}'
```

## Troubleshooting

### Common Issues

1. **Redis Connection Issues** ⚠️ **RESOLVED**
   
   **Symptoms**: "Connection is closed" errors in API logs, script execution failures
   
   **Root Cause**: RedisDistributedLock service was using REDIS_HOST/REDIS_PORT instead of REDIS_URL
   
   **Solution Applied**: Updated RedisDistributedLock to properly use REDIS_URL configuration
   
   ```bash
   # Verify Redis connectivity (should now work)
   kubectl exec -n mongodb-crud deployment/crud-api -- node -e "
   const Redis = require('ioredis');
   const redis = new Redis(process.env.REDIS_URL);
   redis.ping().then(console.log).catch(console.error).finally(() => process.exit());
   "
   
   # Check distributed locking is working
   kubectl logs -n mongodb-crud deployment/crud-api | grep -E "(Lock|lock|✅|🔒|🔓)"
   
   # Test scheduled script execution
   curl -H "Host: crud-api.local" -H "Content-Type: application/json" \
        -X POST http://localhost/api/scripts/scheduled/cronRun/trigger
   ```

2. **Script Execution Coordination** ✅ **WORKING**
   
   **Expected Behavior**: Only one instance executes scheduled scripts, others skip with "already executing" message
   
   ```bash
   # Check distributed script execution
   kubectl logs -n mongodb-crud deployment/crud-api --tail=20 | grep -E "(cronRun|testScheduledScript|🚫|✅)"
   
   # View scheduled scripts status
   curl -H "Host: crud-api.local" http://localhost/api/scripts/scheduled/list
   ```

3. **Leadership Not Working**
   ```bash
   # Check leader election logs
   kubectl logs -n mongodb-crud deployment/crud-api | grep -i leader
   
   # Force new election
   curl -X POST http://crud-api.local/api/cluster/leadership/force -d '{"service":"cron"}'
   ```

3. **Scaling Issues**
   ```bash
   # Check HPA
   kubectl describe hpa crud-api-hpa -n mongodb-crud
   
   # Check metrics server
   kubectl top pods -n mongodb-crud
   ```

### Logs

```bash
# Application logs
kubectl logs -f deployment/crud-api -n mongodb-crud

# All component logs
kubectl logs -f -l app=crud-api -n mongodb-crud
kubectl logs -f -l app=redis -n mongodb-crud
kubectl logs -f -l app=mongodb -n mongodb-crud
```

## Security

### Network Policies

The deployment includes network policies that:
- Allow API pods to communicate with MongoDB and Redis
- Allow inbound traffic to API pods
- Restrict egress to necessary services only

### Secrets Management

Update the Secret with your actual credentials:

```bash
kubectl create secret generic crud-api-secrets \
  --from-literal=MONGODB_CONNECTION_STRING="mongodb://username:password@mongodb:27017" \
  --from-literal=REDIS_URL="redis://redis:6379" \
  -n mongodb-crud
```

## Performance Tuning

### Resource Limits

Adjust based on your workload:

```yaml
resources:
  requests:
    memory: "256Mi"    # Minimum memory
    cpu: "200m"        # Minimum CPU
  limits:
    memory: "512Mi"    # Maximum memory
    cpu: "500m"        # Maximum CPU
```

### Redis Configuration

For high-traffic environments:

```yaml
- redis-server
- --maxmemory
- "1gb"                    # Increase memory
- --maxmemory-policy
- "allkeys-lru"
- --tcp-keepalive
- "60"
```

## Backup and Recovery

### MongoDB Backup

```bash
# Create backup job
kubectl create job mongodb-backup --image=mongo:7 -n mongodb-crud \
  -- mongodump --host mongodb:27017 --out /backup

# Extract backup
kubectl cp mongodb-crud/mongodb-backup-xxx:/backup ./mongodb-backup
```

### Redis Backup

```bash
# Redis data is persistent via PVC
# Backup PVC using your storage provider's tools
```

This deployment provides a production-ready, scalable MongoDB CRUD API with full distributed coordination capabilities.
