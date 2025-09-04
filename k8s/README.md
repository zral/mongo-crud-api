# Kubernetes Deployment Guide

This guide covers deploying the MongoDB CRUD API with full scalability features in a Kubernetes cluster.

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

### 1. Build and Push Docker Image

```bash
# Build the image
docker build -t crud-api:latest .

# Tag for your registry
docker tag crud-api:latest your-registry/crud-api:latest

# Push to registry
docker push your-registry/crud-api:latest
```

### 2. Update Image Reference

Edit `k8s/deployment.yaml` and update the image reference:

```yaml
containers:
- name: crud-api
  image: your-registry/crud-api:latest  # Update this line
```

### 3. Deploy to Kubernetes

```bash
# Apply the deployment
kubectl apply -f k8s/deployment.yaml

# Check the deployment status
kubectl get pods -n mongodb-crud
kubectl get services -n mongodb-crud
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

## Monitoring

### Health Checks

```bash
# Basic health
curl http://crud-api.local/health

# Cluster health
curl http://crud-api.local/api/cluster/health

# Detailed status
curl http://crud-api.local/api/cluster/status
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

1. **Redis Connection Issues**
   ```bash
   # Check Redis pod
   kubectl logs -n mongodb-crud deployment/redis
   
   # Test Redis connectivity
   kubectl exec -n mongodb-crud $POD_NAME -- redis-cli -h redis ping
   ```

2. **Leadership Not Working**
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
