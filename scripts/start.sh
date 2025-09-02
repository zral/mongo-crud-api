#!/bin/bash

# MongoDB CRUD API - Startup Script

echo "🚀 Starting MongoDB CRUD API..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Docker is installed
if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
    echo "❌ Docker Compose is not available. Please install Docker Compose first."
    exit 1
fi

# Determine docker-compose command
if command_exists docker-compose; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "📦 Building and starting containers..."

# Stop any existing containers
$DOCKER_COMPOSE down

# Build and start the containers
$DOCKER_COMPOSE up -d --build

echo "⏳ Waiting for services to be ready..."

# Wait for MongoDB to be ready
echo "Waiting for MongoDB..."
timeout=60
while [ $timeout -gt 0 ]; do
    if docker exec mongo-crud-db mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "✅ MongoDB is ready!"
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done

if [ $timeout -le 0 ]; then
    echo "❌ MongoDB failed to start within 60 seconds"
    $DOCKER_COMPOSE logs mongo
    exit 1
fi

# Wait for API to be ready
echo "Waiting for API..."
timeout=60
while [ $timeout -gt 0 ]; do
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ API is ready!"
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done

if [ $timeout -le 0 ]; then
    echo "❌ API failed to start within 60 seconds"
    $DOCKER_COMPOSE logs api
    exit 1
fi

echo ""
echo "🎉 MongoDB CRUD API is now running!"
echo ""
echo "📋 Service Information:"
echo "   - API URL: http://localhost:3000"
echo "   - Health Check: http://localhost:3000/health"
echo "   - Management API: http://localhost:3000/api/management/collections"
echo "   - MongoDB: localhost:27017"
echo ""
echo "🔧 Available Commands:"
echo "   - View logs: $DOCKER_COMPOSE logs -f"
echo "   - Stop services: $DOCKER_COMPOSE down"
echo "   - Run tests: npm test"
echo ""
echo "📖 API Endpoints:"
echo "   - GET /api/{collection} - List documents"
echo "   - POST /api/{collection} - Create document"
echo "   - GET /api/{collection}/{id} - Get document by ID"
echo "   - PUT /api/{collection}/{id} - Update document"
echo "   - DELETE /api/{collection}/{id} - Delete document"
echo "   - GET /api/management/collections - List collections"
echo "   - POST /api/management/collections - Create collection"
echo "   - DELETE /api/management/collections/{name} - Drop collection"
