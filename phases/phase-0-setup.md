# Phase 0: Foundation & Infrastructure Setup

## Overview
**Duration**: 4-6 hours  
**Goal**: Set up the development environment, repository structure, and CI/CD pipeline  
**Success Metric**: A deployed "Hello World" worker accessible via URL

## Step-by-Step Implementation

### Step 1: Initialize Project Structure
```bash
# Create project directory
mkdir dead-link-switchboard
cd dead-link-switchboard

# Initialize git repository
git init
echo "# Dead Link Switchboard" > README.md
git add README.md
git commit -m "Initial commit"

# Create .gitignore
cat > .gitignore << EOF
node_modules/
dist/
.wrangler/
.dev.vars
.env
.DS_Store
*.log
EOF

# Initialize npm project
npm init -y
```

**✓ Test Point 1.1**: Verify git repo is initialized
```bash
git status
# Should show clean working tree
```

### Step 2: Install Dependencies
```bash
# Install Cloudflare Wrangler and dev dependencies
npm install -D wrangler @cloudflare/workers-types typescript vitest

# Install runtime dependencies
npm install nanoid

# Update package.json scripts
npm pkg set scripts.dev="wrangler dev"
npm pkg set scripts.deploy="wrangler deploy"
npm pkg set scripts.test="vitest"
npm pkg set scripts.test:ci="vitest run"
```

**✓ Test Point 2.1**: Verify installations
```bash
npx wrangler --version
# Should output: ⛅️ wrangler 3.x.x
```

### Step 3: Configure Wrangler
```bash
# Create wrangler.toml
cat > wrangler.toml << EOF
name = "dead-link-switchboard"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.staging]
name = "dead-link-switchboard-staging"

[env.production]
name = "dead-link-switchboard-prod"
EOF

# Create source directory
mkdir src

# Create hello world worker
cat > src/index.js << 'EOF'
export default {
  async fetch(request, env, ctx) {
    return new Response('Dead Link Switchboard - Hello World!', {
      headers: { 'content-type': 'text/plain' },
    });
  },
};
EOF
```

**✓ Test Point 3.1**: Test local development
```bash
npm run dev
# Open http://localhost:8787 in browser
# Should see: "Dead Link Switchboard - Hello World!"
# Press 'x' to stop
```

### Step 4: Set Up KV Namespaces
```bash
# Create KV namespaces for different environments
npx wrangler kv:namespace create "LINKS"
npx wrangler kv:namespace create "LINKS" --env staging
npx wrangler kv:namespace create "LINKS" --env production

# Add to wrangler.toml (replace with your actual IDs)
cat >> wrangler.toml << 'EOF'

[[kv_namespaces]]
binding = "LINKS"
id = "YOUR_DEV_KV_ID"

[env.staging]
[[env.staging.kv_namespaces]]
binding = "LINKS"
id = "YOUR_STAGING_KV_ID"

[env.production]
[[env.production.kv_namespaces]]
binding = "LINKS"
id = "YOUR_PROD_KV_ID"
EOF
```

**✓ Test Point 4.1**: Verify KV binding works
```bash
# Update src/index.js to test KV
cat > src/index.js << 'EOF'
export default {
  async fetch(request, env, ctx) {
    // Test KV write/read
    await env.LINKS.put("test", "Hello KV!");
    const value = await env.LINKS.get("test");
    
    return new Response(`KV Test: ${value}`, {
      headers: { 'content-type': 'text/plain' },
    });
  },
};
EOF

# Run and test
npm run dev
# Visit http://localhost:8787
# Should see: "KV Test: Hello KV!"
```

### Step 5: Create GitHub Repository & Actions
```bash
# Create GitHub repo (using GitHub CLI)
gh repo create dead-link-switchboard --public --source=. --remote=origin --push

# Create GitHub Actions workflow
mkdir -p .github/workflows

cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:ci

  deploy:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: production
EOF

# Create test workflow
cat > .github/workflows/test.yml << 'EOF'
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:ci
EOF
```

### Step 6: Configure Cloudflare API Token
```bash
# Get your Cloudflare API token
# 1. Go to https://dash.cloudflare.com/profile/api-tokens
# 2. Create token with "Edit Cloudflare Workers" permissions
# 3. Add to GitHub secrets

# Test deployment locally first
npx wrangler deploy --dry-run

# If using GitHub CLI:
gh secret set CLOUDFLARE_API_TOKEN
# Paste your token when prompted
```

**✓ Test Point 6.1**: Verify GitHub Actions
```bash
# Create a test branch
git checkout -b test-ci
git add .
git commit -m "Test CI pipeline"
git push -u origin test-ci

# Create PR and verify checks pass
gh pr create --title "Test CI" --body "Testing CI pipeline"
```

### Step 7: Create Basic Test Suite
```bash
# Create test file
mkdir -p test
cat > test/index.test.js << 'EOF'
import { describe, it, expect } from 'vitest';

describe('Worker', () => {
  it('should return hello world', async () => {
    const response = await fetch('http://localhost:8787');
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain('KV Test:');
  });
});
EOF

# Create vitest config
cat > vitest.config.js << 'EOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
EOF
```

**✓ Test Point 7.1**: Run tests
```bash
# Start dev server in one terminal
npm run dev

# In another terminal, run tests
npm test
# Should show passing tests
```

### Step 8: Project Structure Verification
```bash
# Your project structure should look like this:
tree -I 'node_modules'
# .
# ├── .github/
# │   └── workflows/
# │       ├── deploy.yml
# │       └── test.yml
# ├── .gitignore
# ├── README.md
# ├── package.json
# ├── package-lock.json
# ├── src/
# │   └── index.js
# ├── test/
# │   └── index.test.js
# ├── vitest.config.js
# └── wrangler.toml
```

### Step 9: Deploy to Staging
```bash
# Deploy to staging environment
npx wrangler deploy --env staging

# You should see output like:
# Uploaded dead-link-switchboard-staging (1.23 sec)
# Published dead-link-switchboard-staging (0.45 sec)
#   https://dead-link-switchboard-staging.YOUR-SUBDOMAIN.workers.dev
```

**✓ Test Point 9.1**: Verify staging deployment
```bash
# Test the deployed worker
curl https://dead-link-switchboard-staging.YOUR-SUBDOMAIN.workers.dev
# Should return: "KV Test: Hello KV!"
```

### Step 10: Create Development Documentation
```bash
# Create development setup guide
cat > DEVELOPMENT.md << 'EOF'
# Development Setup

## Prerequisites
- Node.js 18+
- Cloudflare account
- GitHub account

## Local Development
1. Clone the repository
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`
4. Run tests: `npm test`

## Deployment
- Staging: `npx wrangler deploy --env staging`
- Production: Automated via GitHub Actions on merge to main

## Environment Variables
Create `.dev.vars` for local development:
```
# Add any secrets here
API_KEY=your-key-here
```
EOF

git add .
git commit -m "Complete Phase 0 setup"
git push
```

## Phase 0 Completion Checklist

### Core Infrastructure ✓
- [x] Git repository initialized
- [x] NPM project with dependencies
- [x] Wrangler configuration
- [x] KV namespaces created
- [x] Basic worker deployed

### CI/CD Pipeline ✓
- [x] GitHub Actions for testing
- [x] Automated deployment on main
- [x] Cloudflare API token configured
- [x] Test suite running

### Testing Confirmation ✓
- [x] Local development server works
- [x] KV read/write functional
- [x] Staging deployment accessible
- [x] CI pipeline green

## Next Steps
With Phase 0 complete, you now have:
- A working development environment
- CI/CD pipeline for safe deployments
- Basic test infrastructure
- KV storage ready for link data

Proceed to Phase 1 to build the core redirect functionality.