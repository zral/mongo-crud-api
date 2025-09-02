@echo off
REM Quick GitHub Setup Script for MongoDB CRUD API (Windows)

echo 🚀 MongoDB CRUD API - GitHub Setup
echo ==================================

REM Check if git is available
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git is not installed. Please install Git first:
    echo    Download from: https://git-scm.com/download/windows
    pause
    exit /b 1
)

echo ✅ Git is installed

REM Check if we're in a git repository
if not exist ".git" (
    echo 📦 Initializing Git repository...
    git init
) else (
    echo ✅ Git repository already initialized
)

REM Show current status
echo 📊 Current repository status:
git status --short

echo.
echo 🔧 Next steps:
echo 1. Create a new repository on GitHub.com
echo 2. Run: git add .
echo 3. Run: git commit -m "Initial commit: Enterprise MongoDB CRUD API"
echo 4. Run: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
echo 5. Run: git branch -M main
echo 6. Run: git push -u origin main

echo.
echo 📝 Repository features to highlight in your GitHub description:
echo - ✅ Enterprise MongoDB CRUD REST API
echo - ✅ React Frontend with Management Interface  
echo - ✅ Webhook System with Rate Limiting
echo - ✅ TypeScript SDK Generation
echo - ✅ OpenAPI/Swagger Documentation
echo - ✅ Docker Containerization
echo - ✅ Comprehensive Test Suite

pause
