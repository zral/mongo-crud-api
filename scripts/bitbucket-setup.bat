@echo off
REM Bitbucket Setup Script for MongoDB CRUD API (Windows)

echo 🚀 MongoDB CRUD API - Bitbucket Setup
echo =====================================

REM Check if git is available
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git is not installed. Please install Git first:
    echo    Download from: https://git-scm.com/download/windows
    echo    Or install via winget: winget install Git.Git
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
echo 🔧 Step-by-step Bitbucket setup:
echo =================================
echo.
echo 1. First, create a repository on Bitbucket.org:
echo    - Go to https://bitbucket.org
echo    - Click "Create" -^> "Repository"
echo    - Repository name: mongodb-crud-api
echo    - Description: Enterprise MongoDB CRUD REST API with React Frontend
echo    - Access level: Private or Public (your choice)
echo    - DO NOT include README or .gitignore (you already have them)
echo.
echo 2. Then run these Git commands:
echo.
echo    git config --global user.name "Your Name"
echo    git config --global user.email "your.email@example.com"
echo    git add .
echo    git commit -m "Initial commit: Enterprise MongoDB CRUD API with full features"
echo    git remote add origin https://bitbucket.org/YOUR_USERNAME/YOUR_REPO_NAME.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo 📝 Copy this description for your Bitbucket repository:
echo ======================================================
echo Enterprise-grade MongoDB CRUD REST API with React frontend, advanced webhook
echo system, TypeScript SDK generation, and comprehensive Docker deployment.
echo.
echo Features include:
echo • Dynamic collection CRUD operations with MongoDB-style filtering
echo • Enterprise webhook system with per-webhook rate limiting ^& retry logic
echo • Database connection resilience with automatic reconnection
echo • TypeScript SDK auto-generation with OpenAPI 3.0 specification
echo • Interactive Swagger UI documentation
echo • React management interface with real-time collection statistics
echo • Docker containerization with health checks and optimization
echo • Comprehensive test suite and production-ready documentation
echo.
echo 🏷️ Suggested topics: mongodb, nodejs, react, webhook, rest-api, docker, typescript
echo.
pause
