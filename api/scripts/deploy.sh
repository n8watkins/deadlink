#!/bin/bash

# Deployment Script for Dead Link Switchboard
# Handles deployment to different environments with safety checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="Dead Link Switchboard API"

# Environment check
if [ -z "$1" ]; then
    echo "Usage: $0 <environment>"
    echo "Available environments: development, staging, production"
    exit 1
fi

ENVIRONMENT=$1

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Validate environment
case $ENVIRONMENT in
    development|dev)
        WRANGLER_ENV=""
        ENV_NAME="development"
        ;;
    staging|stage)
        WRANGLER_ENV="--config wrangler.staging.toml"
        ENV_NAME="staging"
        ;;
    production|prod)
        WRANGLER_ENV="--config wrangler.prod.toml"
        ENV_NAME="production"
        ;;
    *)
        print_error "Invalid environment: $ENVIRONMENT"
        echo "Valid environments: development, staging, production"
        exit 1
        ;;
esac

echo "🚀 Deploying $PROJECT_NAME to $ENV_NAME environment"
echo "================================================"

# Pre-deployment checks
print_status "Running pre-deployment checks..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found. Please install it first."
    exit 1
fi

# Check if logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    print_error "Not logged in to Cloudflare. Run 'wrangler login' first."
    exit 1
fi

# Generate environment file if it doesn't exist
ENV_FILE=".env.$ENV_NAME"
if [ ! -f "$ENV_FILE" ]; then
    print_warning "Environment file $ENV_FILE not found. Generating..."
    node scripts/generate-salts.js "$ENV_NAME"
fi

# Run tests (if in CI/CD or production deployment)
if [ "$ENV_NAME" = "production" ] || [ "$CI" = "true" ]; then
    print_status "Running tests..."
    npm test || {
        print_error "Tests failed. Aborting deployment."
        exit 1
    }
fi

# Check for uncommitted changes
if [ "$ENV_NAME" = "production" ]; then
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "You have uncommitted changes:"
        git status --short
        read -p "Continue with deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled"
            exit 1
        fi
    fi
fi

# Build project (if needed)
if [ -f "build.sh" ]; then
    print_status "Building project..."
    ./build.sh
fi

# Create backup before production deployment
if [ "$ENV_NAME" = "production" ]; then
    print_status "Creating database backup..."
    ./scripts/db-backup.sh production || print_warning "Backup failed, but continuing..."
fi

# Apply pending migrations
print_status "Checking for pending migrations..."
./scripts/migrate.sh "$ENV_NAME" || {
    print_error "Migration failed. Aborting deployment."
    exit 1
}

# Deploy to Cloudflare Workers
print_status "Deploying to Cloudflare Workers..."
if [ "$ENV_NAME" = "development" ]; then
    wrangler deploy
else
    wrangler deploy $WRANGLER_ENV
fi

# Post-deployment checks
print_status "Running post-deployment checks..."

# Get worker URL
if [ "$ENV_NAME" = "development" ]; then
    WORKER_URL="http://localhost:8787"
elif [ "$ENV_NAME" = "staging" ]; then
    WORKER_URL="https://staging-api.deadlink.io"
else
    WORKER_URL="https://api.deadlink.io"
fi

# Wait for worker to be ready
sleep 5

# Health check
print_status "Running health check..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/health?basic=true" || echo "000")

if [ "$HEALTH_RESPONSE" = "200" ]; then
    print_status "Health check passed!"
else
    print_error "Health check failed (HTTP $HEALTH_RESPONSE)"
    print_warning "Worker may still be initializing. Check manually: $WORKER_URL/health"
fi

# Tag release for production
if [ "$ENV_NAME" = "production" ]; then
    VERSION=$(date +%Y%m%d-%H%M%S)
    print_status "Tagging release as v$VERSION..."
    git tag -a "v$VERSION" -m "Production deployment $VERSION" || print_warning "Failed to create git tag"
fi

# Summary
echo ""
echo "================================================"
print_status "Deployment completed successfully!"
echo ""
echo "Environment: $ENV_NAME"
echo "URL: $WORKER_URL"
echo "Health Check: $WORKER_URL/health"
echo ""

# Environment-specific notes
case $ENV_NAME in
    development)
        echo "To test locally: wrangler dev"
        ;;
    staging)
        echo "Staging URL: https://staging-api.deadlink.io"
        echo "Run integration tests: npm run test:integration"
        ;;
    production)
        echo "Production URL: https://api.deadlink.io"
        echo "Monitor logs: wrangler tail $WRANGLER_ENV"
        echo "Check analytics: https://dash.cloudflare.com"
        ;;
esac

echo ""
print_status "Deployment complete! 🎉"