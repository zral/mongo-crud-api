@echo off
REM MongoDB CRUD API - Windows Test Script

echo 🧪 MongoDB CRUD API Test Script
echo ===============================

set API_URL=http://localhost:8080

REM Function to check if API is running
echo 🔍 Checking if API is running...
curl -s %API_URL%/health | findstr "healthy" >nul
if errorlevel 1 (
    echo ❌ API is not responding properly
    echo 💡 To start the API, run: npm run docker:up
    exit /b 1
) else (
    echo ✅ API is running and healthy
)

REM Basic tests
echo.
echo 🚀 Running Basic Tests...
echo ------------------------

echo 1. Listing collections...
curl -s %API_URL%/api/management/collections
echo.

echo.
echo 2. Creating a test user...
curl -s -X POST -H "Content-Type: application/json" -d "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"age\":25}" %API_URL%/api/users
echo.

echo.
echo 3. Getting users...
curl -s %API_URL%/api/users?limit=2
echo.

REM Management tests
echo.
echo 🔧 Running Management Tests...
echo -----------------------------

echo 1. Creating new collection 'test_collection'...
curl -s -X POST -H "Content-Type: application/json" -d "{\"name\":\"test_collection\"}" %API_URL%/api/management/collections
echo.

echo.
echo 2. Adding data to new collection...
curl -s -X POST -H "Content-Type: application/json" -d "{\"name\":\"Test Item\",\"value\":123,\"active\":true}" %API_URL%/api/test_collection
echo.

echo.
echo 3. Retrieving data from new collection...
curl -s %API_URL%/api/test_collection
echo.

echo.
echo 4. Dropping test collection...
curl -s -X DELETE %API_URL%/api/management/collections/test_collection
echo.

echo.
echo ✅ Tests completed!
pause
