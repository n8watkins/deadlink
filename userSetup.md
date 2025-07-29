# Dead Link Switchboard - Production Deployment Guide

This guide provides everything needed to deploy Dead Link Switchboard to production, including critical integration fixes required for a functional system.

## ⚠️ CRITICAL: Integration Issues Must Be Fixed First

**Before deploying to production, these integration issues MUST be resolved:**

1. **Authentication System Unification** - Currently fragmented between NextAuth and API keys
2. **API Endpoint Updates** - Frontend calls outdated endpoints 
3. **CORS Configuration** - Not set up for multiple frontend origins
4. **Dashboard Data Connection** - Shows hardcoded fake data instead of live API

See the [Integration Fixes](#integration-fixes) section below for detailed solutions.

## Prerequisites

### Required Accounts & Services
1. **Cloudflare Account** (Pro plan recommended for production)
   - Workers (serverless compute)
   - KV (key-value storage) 
   - D1 (SQL database)
   - Analytics Engine
   - Pages (dashboard hosting)
   - DNS management

2. **Domain Names**
   - Primary domain (e.g., `deadlink.io`)
   - API subdomain (e.g., `api.deadlink.io`)
   - Dashboard subdomain (e.g., `app.deadlink.io`)

3. **GitHub Account** 
   - For repository hosting and CI/CD

### Development Environment
- Node.js 18+ and npm 8+
- Git version control
- Wrangler CLI (Cloudflare deployment tool)

## Production Infrastructure Setup

### 1. Cloudflare Account Configuration

```bash
# Install Wrangler CLI globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Clone the repository
git clone <repository-url>
cd deadlinks-switchboard
npm run install-all
```

### 2. Create Production Resources

#### A. D1 Database (SQL)
```bash
# Create production database
wrangler d1 create dead-link-db-prod

# Create staging database
wrangler d1 create dead-link-db-staging

# Note the database IDs returned
```

#### B. KV Namespaces (Key-Value Storage)
```bash
# Production KV namespace
wrangler kv:namespace create "LINKS" --env production

# Staging KV namespace  
wrangler kv:namespace create "LINKS" --env staging

# Note the namespace IDs returned
```

#### C. Update Configuration Files

Update `api/wrangler.prod.toml`:
```toml
name = "dead-link-api-prod"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "LINKS"
id = "YOUR_PRODUCTION_KV_ID"

[[d1_databases]]
binding = "DB"
database_name = "dead-link-db-prod"  
database_id = "YOUR_PRODUCTION_DB_ID"

[vars]
ENVIRONMENT = "production"
API_BASE_URL = "https://api.deadlink.io"
CORS_ORIGINS = "https://deadlink.io,https://app.deadlink.io"
```

### 3. Database Setup & Migrations

```bash
# Run all migrations to production database
cd api
./scripts/migrate.sh production

# Verify migrations succeeded
wrangler d1 execute dead-link-db-prod --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### 4. Critical Environment Variables

**Required for all environments:**

```bash
# Generate secure salts (run this command)
node api/scripts/generate-salts.js production
```

**Set these in Cloudflare Workers environment:**
```env
# Authentication & Security
API_KEY_SALT=<generated-64-char-string>
HASH_SALT=<generated-64-char-string>
SESSION_SECRET=<generated-64-char-string>

# CORS Configuration
CORS_ORIGINS=https://deadlink.io,https://app.deadlink.io

# Health Monitoring
WEBHOOK_URL=https://your-monitoring-webhook.com
NOTIFICATION_EMAIL=alerts@yourdomain.com

# Production Settings
ENVIRONMENT=production
API_BASE_URL=https://api.deadlink.io
DASHBOARD_URL=https://app.deadlink.io
LANDING_URL=https://deadlink.io
```

## 🚨 Integration Fixes (CRITICAL - Must Complete Before Deployment)

### Fix 1: Authentication System Unification

**Problem**: Dashboard uses NextAuth sessions while API expects API keys.

**Solution**: Implement session-based authentication across all components.

#### A. Update API Authentication Middleware
In `api/src/auth.js`, modify to support session tokens:

```javascript
// Add session token validation alongside API key validation
export async function validateAuth(request, env) {
  const apiKey = request.headers.get('X-API-Key');
  const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (apiKey) {
    return validateApiKey(apiKey, env);
  } else if (sessionToken) {
    return validateSession(sessionToken, env);
  }
  
  return { valid: false, error: 'No authentication provided' };
}
```

#### B. Update Frontend API Calls
In `app/src/lib/api.ts`, replace API key auth with session tokens:

```typescript
// Before (API key)
headers: {
  'X-API-Key': process.env.API_KEY
}

// After (session token)
headers: {
  'Authorization': `Bearer ${session.accessToken}`
}
```

### Fix 2: API Endpoint Updates

**Problem**: Frontend calls outdated endpoints missing 75% of backend features.

**Solution**: Update all frontend API calls to use current endpoints.

#### A. Update API Base URL
In `app/src/lib/api.ts`:

```typescript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.deadlink.io' 
  : 'http://localhost:8787';
```

#### B. Replace Hardcoded Dashboard Data
Update these components to call live APIs:

```typescript
// app/src/app/dashboard/page.tsx
// Replace hardcoded data with:
const [stats, setStats] = useState(null);

useEffect(() => {
  fetchDashboardStats().then(setStats);
}, []);

// app/src/app/dashboard/links/page.tsx  
// Replace mock links with:
const [links, setLinks] = useState([]);

useEffect(() => {
  fetchUserLinks().then(setLinks);
}, []);
```

### Fix 3: CORS Configuration

**Problem**: API not configured for multiple frontend origins.

**Solution**: Configure CORS in API for all required domains.

#### A. Update API CORS Handler
In `api/src/cors-simple.js`:

```javascript
const ALLOWED_ORIGINS = [
  'https://deadlink.io',
  'https://app.deadlink.io', 
  'http://localhost:3000',    // App development
  'http://localhost:3001'     // Landing development
];

export function setCorsHeaders(response, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return response;
}
```

### Fix 4: Dashboard Data Connection

**Problem**: Dashboard shows hardcoded "0" values instead of real data.

**Solution**: Connect all dashboard components to live API endpoints.

#### A. Implement Data Fetching Functions
Create `app/src/lib/dashboard-api.ts`:

```typescript
export async function fetchDashboardStats() {
  const response = await fetch(`${API_BASE_URL}/api/v1/user/stats`);
  return response.json();
}

export async function fetchUserLinks() {
  const response = await fetch(`${API_BASE_URL}/api/v1/links`);
  return response.json();
}

export async function fetchAnalytics() {
  const response = await fetch(`${API_BASE_URL}/api/v1/analytics`);
  return response.json();
}
```

## Domain & DNS Setup

### 1. Configure Cloudflare DNS

Add these DNS records in your Cloudflare dashboard:

```
Type    Name    Content                     Proxy
A       @       192.0.2.1                  ✅ Proxied
CNAME   api     api.yourdomain.workers.dev  ✅ Proxied  
CNAME   app     app.yourdomain.pages.dev    ✅ Proxied
```

### 2. Custom Domain Routes

Update `api/wrangler.prod.toml`:

```toml
[[routes]]
pattern = "api.deadlink.io/*"
zone_name = "deadlink.io"

[[routes]]  
pattern = "deadlink.io/r/*"
zone_name = "deadlink.io"
```

## Production Deployment Steps

### 1. Deploy Backend API

```bash
# Deploy to staging first
cd api
wrangler deploy --env staging --config wrangler.staging.toml

# Test staging deployment
curl https://staging-api.deadlink.io/health

# Deploy to production after testing
wrangler deploy --env production --config wrangler.prod.toml
```

### 2. Deploy Frontend Applications

#### A. Dashboard App
```bash
cd app
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy out --project-name=deadlink-dashboard --env production
```

#### B. Landing Page
```bash  
cd landing
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy .next --project-name=deadlink-landing --env production
```

### 3. Configure Cron Jobs

Health checks run automatically via Cloudflare Cron Triggers:

```toml
# In api/wrangler.prod.toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

### 4. Set Up Monitoring

#### A. Health Check Endpoints
```bash
# Verify health endpoints work
curl https://api.deadlink.io/health
curl https://api.deadlink.io/api/health/stats
```

#### B. Error Alerting
Configure webhook notifications for critical errors:
```bash
# Test webhook notifications
curl -X POST https://api.deadlink.io/api/test/webhook
```

## Production Checklist

### ✅ Infrastructure Ready
- [ ] **Integration fixes completed** (authentication, CORS, API endpoints, dashboard data)
- [ ] **Cloudflare resources created** (D1 database, KV namespaces)
- [ ] **Environment variables set** (salts, secrets, URLs)
- [ ] **Database migrations applied** (all tables created)
- [ ] **Custom domains configured** (DNS, SSL certificates)

### ✅ Security Configured
- [ ] **Secure password hashing** (bcrypt implemented)
- [ ] **CSRF protection enabled** (all auth endpoints)
- [ ] **Rate limiting active** (login attempts, API calls)
- [ ] **Session management** (secure cookies, expiry)
- [ ] **No hardcoded secrets** (all moved to environment variables)

### ✅ Monitoring Active
- [ ] **Health checks running** (cron jobs every 5 minutes)
- [ ] **Error logging enabled** (database storage, webhook alerts)
- [ ] **Performance monitoring** (Analytics Engine configured)
- [ ] **Backup system** (automated daily backups)

### ✅ Testing Complete
- [ ] **End-to-end user flow** (signup → login → create link → redirect)
- [ ] **API functionality** (all endpoints responding correctly)
- [ ] **Frontend integration** (dashboard shows real data)
- [ ] **Cross-browser compatibility** (Chrome, Firefox, Safari, Edge)

## Post-Deployment Verification

### 1. Test Core Functionality
```bash
# Test link creation via API
curl -X POST https://api.deadlink.io/api/v1/links \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "custom_slug": "test"}'

# Test redirect functionality  
curl -I https://deadlink.io/r/test

# Test dashboard authentication
curl https://app.deadlink.io/dashboard
```

### 2. Monitor for 24 Hours
- Check error logs for any issues
- Verify health checks are passing
- Monitor performance metrics
- Test user signup and login flows

## Troubleshooting Common Issues

### Authentication Problems
```bash
# Check session token generation
curl https://api.deadlink.io/api/auth/session -v

# Verify CORS headers
curl -H "Origin: https://app.deadlink.io" https://api.deadlink.io/health -v
```

### Database Connection Issues
```bash
# Test D1 database connection
wrangler d1 execute dead-link-db-prod --command "SELECT COUNT(*) FROM links"

# Check KV namespace access
wrangler kv:key list --namespace-id=YOUR_PRODUCTION_KV_ID
```

### Frontend Build Problems
```bash
# Check build logs
npm run build --workspace=app 2>&1 | tee build.log

# Verify environment variables
echo $API_BASE_URL
echo $NEXTAUTH_SECRET
```

## Support & Maintenance

### Daily Tasks
- Monitor error logs and health check status
- Review performance metrics and user analytics
- Check backup completion status

### Weekly Tasks  
- Review security logs for suspicious activity
- Update dependencies and security patches
- Analyze user feedback and feature requests

### Monthly Tasks
- Database performance optimization
- Cost analysis and resource usage review
- Security audit and penetration testing

---

**⚠️ REMINDER: Complete all integration fixes before deploying to production!**

The system is technically ready for deployment, but the integration issues will prevent normal user functionality. Address these issues first, then follow this deployment guide for a successful production launch.

