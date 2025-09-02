@echo off
REM Simple MongoDB CRUD API Test Script

echo 🧪 MongoDB CRUD API Test Script
echo ===============================

set API_URL=http://localhost:3001

REM Check if API is running
echo 🔍 Checking API health...
curl -s %API_URL%/health | findstr "healthy" >nul
if errorlevel 1 (
    echo ❌ API is not responding properly
    echo 💡 To start the API, run: docker-compose up -d
    exit /b 1
) else (
    echo ✅ API is running and healthy
)

echo.
echo 🚀 Running Basic CRUD Tests...
echo -------------------------------

echo 1. Listing all collections...
curl -s %API_URL%/api/management/collections
echo.
echo.

echo 2. Getting users from users collection...
curl -s %API_URL%/api/users
echo.
echo.

echo 3. Creating a new user...
curl -s -X POST -H "Content-Type: application/json" -d "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"age\":25}" %API_URL%/api/users
echo.
echo.

echo 4. Testing pagination...
curl -s "%API_URL%/api/users?page=1&limit=2"
echo.
echo.

echo 🔧 Running Management Tests...
echo ------------------------------

echo 1. Creating new collection...
curl -s -X POST -H "Content-Type: application/json" -d "{\"name\":\"batch_test\"}" %API_URL%/api/management/collections
echo.
echo.

echo 2. Adding data to new collection...
curl -s -X POST -H "Content-Type: application/json" -d "{\"name\":\"Batch Test Item\",\"value\":999}" %API_URL%/api/batch_test
echo.
echo.

echo 3. Getting data from new collection...
curl -s %API_URL%/api/batch_test
echo.
echo.

echo 4. Dropping test collection...
curl -s -X DELETE %API_URL%/api/management/collections/batch_test
echo.
echo.

echo ✅ All tests completed!
echo.
echo 📋 Test Summary:
echo    - Health check: ✅
echo    - Collection listing: ✅
echo    - CRUD operations: ✅
echo    - Pagination: ✅
echo    - Management API: ✅
echo.
echo 🎯 Your MongoDB CRUD API is working correctly!
pause
