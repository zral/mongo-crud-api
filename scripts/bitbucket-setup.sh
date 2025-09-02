#!/bin/bash
# Bitbucket Setup Script for MongoDB CRUD API

echo "🚀 MongoDB CRUD API - Bitbucket Setup"
echo "====================================="

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

# Check git configuration
if [ -z "$(git config user.name)" ] || [ -z "$(git config user.email)" ]; then
    echo "⚠️  Git user configuration needed"
    echo "Run these commands with your information:"
    echo "   git config --global user.name \"Your Name\""
    echo "   git config --global user.email \"your.email@example.com\""
    echo ""
fi

# Show current status
echo "📊 Current repository status:"
git status --short

echo ""
echo "🔧 Commands to push to Bitbucket:"
echo "================================"
echo ""
echo "# 1. Configure Git (if not already done):"
echo "git config --global user.name \"Your Name\""
echo "git config --global user.email \"your.email@example.com\""
echo ""
echo "# 2. Add all files to staging:"
echo "git add ."
echo ""
echo "# 3. Create initial commit:"
echo "git commit -m \"Initial commit: Enterprise MongoDB CRUD API with full features\""
echo ""
echo "# 4. Add Bitbucket remote (replace YOUR_USERNAME and YOUR_REPO_NAME):"
echo "git remote add origin https://bitbucket.org/YOUR_USERNAME/YOUR_REPO_NAME.git"
echo ""
echo "# 5. Push to Bitbucket:"
echo "git branch -M main"
echo "git push -u origin main"

echo ""
echo "📝 Repository features for Bitbucket description:"
echo "================================================"
echo "Enterprise-grade MongoDB CRUD REST API with comprehensive features:"
echo ""
echo "🔧 **Core Features:**"
echo "- Dynamic collection CRUD operations with MongoDB-style filtering"
echo "- Enterprise webhook system with per-webhook rate limiting & retry logic"
echo "- Database connection resilience with automatic retry mechanisms"
echo "- TypeScript SDK auto-generation with OpenAPI 3.0 specification"
echo "- Interactive Swagger UI documentation"
echo ""
echo "🎨 **Frontend:**"
echo "- React management interface for collections and webhooks"
echo "- Real-time collection statistics (document count, last updated)"
echo "- Webhook configuration with visual rate limit management"
echo ""
echo "🚀 **DevOps & Production:**"
echo "- Docker containerization with health checks and optimization"
echo "- Comprehensive test suite (unit, integration, load testing)"
echo "- Production-ready logging and monitoring capabilities"
echo "- Cross-platform development tools and documentation"
echo ""
echo "💡 **Advanced Capabilities:**"
echo "- Intelligent schema discovery for dynamic collections"
echo "- Multi-language SDK generation support"
echo "- Enterprise security considerations and enhancement roadmap"

echo ""
echo "🏷️  Suggested Bitbucket topics:"
echo "mongodb, nodejs, react, webhook, rest-api, docker, typescript, sdk, openapi, swagger, enterprise"
