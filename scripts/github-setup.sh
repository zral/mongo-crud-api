#!/bin/bash
# Quick GitHub Setup Script for MongoDB CRUD API

echo "🚀 MongoDB CRUD API - GitHub Setup"
echo "=================================="

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first:"
    echo "   Download from: https://git-scm.com/download/windows"
    exit 1
fi

echo "✅ Git is installed"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
else
    echo "✅ Git repository already initialized"
fi

# Show current status
echo "📊 Current repository status:"
git status --short

echo ""
echo "🔧 Next steps:"
echo "1. Create a new repository on GitHub.com"
echo "2. Run: git add ."
echo "3. Run: git commit -m \"Initial commit: Enterprise MongoDB CRUD API\""
echo "4. Run: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"
echo "5. Run: git branch -M main"
echo "6. Run: git push -u origin main"

echo ""
echo "📝 Repository features to highlight in your GitHub description:"
echo "- ✅ Enterprise MongoDB CRUD REST API"
echo "- ✅ React Frontend with Management Interface"
echo "- ✅ Webhook System with Rate Limiting"
echo "- ✅ TypeScript SDK Generation"
echo "- ✅ OpenAPI/Swagger Documentation"
echo "- ✅ Docker Containerization"
echo "- ✅ Comprehensive Test Suite"
