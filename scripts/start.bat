@echo off
REM MongoDB CRUD API - Windows Startup Script

echo 🚀 Starting MongoDB CRUD API...

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed. Please install Docker first.
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker Compose is not available. Please install Docker Compose first.
        exit /b 1
    )
    set DOCKER_COMPOSE=docker compose
) else (
    set DOCKER_COMPOSE=docker-compose
)

echo 📦 Building and starting containers...

REM Stop any existing containers
%DOCKER_COMPOSE% down

REM Build and start the containers
%DOCKER_COMPOSE% up -d --build

echo ⏳ Waiting for services to be ready...

REM Wait for MongoDB to be ready
echo Waiting for MongoDB...
set /a timeout=30
:wait_mongo
docker exec mongo-crud-db mongosh --eval "db.adminCommand('ping')" >nul 2>&1
if errorlevel 0 (
    echo ✅ MongoDB is ready!
    goto wait_api
)
timeout /t 2 /nobreak >nul
set /a timeout-=1
if %timeout% gtr 0 goto wait_mongo

echo ❌ MongoDB failed to start within 60 seconds
%DOCKER_COMPOSE% logs mongo
exit /b 1

:wait_api
REM Wait for API to be ready
echo Waiting for API...
set /a timeout=30
:wait_api_loop
curl -f http://localhost:3000/health >nul 2>&1
if errorlevel 0 (
    echo ✅ API is ready!
    goto success
)
timeout /t 2 /nobreak >nul
set /a timeout-=1
if %timeout% gtr 0 goto wait_api_loop

echo ❌ API failed to start within 60 seconds
%DOCKER_COMPOSE% logs api
exit /b 1

:success
echo.
echo 🎉 MongoDB CRUD API is now running!
echo.
echo 📋 Service Information:
echo    - API URL: http://localhost:3001
echo    - Health Check: http://localhost:3001/health
echo    - Management API: http://localhost:3001/api/management/collections
echo    - MongoDB: localhost:27017
echo.
echo 🔧 Available Commands:
echo    - View logs: %DOCKER_COMPOSE% logs -f
echo    - Stop services: %DOCKER_COMPOSE% down
echo    - Run tests: powershell -ExecutionPolicy Bypass -File scripts\test-api.ps1
echo.
echo 📖 API Endpoints:
echo    - GET /api/{collection} - List documents
echo    - POST /api/{collection} - Create document
echo    - GET /api/{collection}/{id} - Get document by ID
echo    - PUT /api/{collection}/{id} - Update document
echo    - DELETE /api/{collection}/{id} - Delete document
echo    - GET /api/management/collections - List collections
echo    - POST /api/management/collections - Create collection
echo    - DELETE /api/management/collections/{name} - Drop collection
