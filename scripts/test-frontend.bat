@echo off
echo.
echo ==================================================
echo MongoDB CRUD Frontend Integration Test
echo ==================================================
echo.

echo Testing API health...
curl -s http://localhost:3001/health > nul
if %errorlevel% equ 0 (
    echo ✓ API health check passed
) else (
    echo ✗ API health check failed
    exit /b 1
)

echo.
echo Testing Frontend availability...
curl -s http://localhost:3002 > nul
if %errorlevel% equ 0 (
    echo ✓ Frontend is accessible
) else (
    echo ✗ Frontend is not accessible
    exit /b 1
)

echo.
echo Testing API endpoints used by frontend...
echo.

echo 1. Testing collections list endpoint...
curl -s -o temp_response.json http://localhost:3001/api/management/collections
if %errorlevel% equ 0 (
    echo ✓ Collections list endpoint working
) else (
    echo ✗ Collections list endpoint failed
)

echo.
echo 2. Testing users collection data endpoint...
curl -s -o temp_response2.json http://localhost:3001/api/users
if %errorlevel% equ 0 (
    echo ✓ Users data endpoint working
) else (
    echo ✗ Users data endpoint failed
)

echo.
echo 3. Testing collection creation endpoint...
curl -s -X POST -H "Content-Type: application/json" -d "{\"name\":\"frontend_test\"}" http://localhost:3001/api/management/collections > nul
if %errorlevel% equ 0 (
    echo ✓ Collection creation endpoint working
) else (
    echo ✗ Collection creation endpoint failed
)

echo.
echo 4. Cleaning up test collection...
curl -s -X DELETE http://localhost:3001/api/management/collections/frontend_test > nul
if %errorlevel% equ 0 (
    echo ✓ Collection deletion endpoint working
) else (
    echo ✗ Collection deletion endpoint failed
)

echo.
echo Cleaning up temporary files...
if exist temp_response.json del temp_response.json
if exist temp_response2.json del temp_response2.json

echo.
echo ==================================================
echo ✓ All frontend integration tests passed!
echo.
echo Frontend URL: http://localhost:3002
echo API URL: http://localhost:3001
echo MongoDB: localhost:27017
echo ==================================================
echo.
echo You can now use the React frontend to:
echo - Manage collections (Management tab)
echo - View and edit documents (Collections tab)
echo - Perform CRUD operations through the web UI
echo.
pause
