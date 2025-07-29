# Dead Link Switchboard - Deployment Status & Action Plan

## 🔴 DEPLOYMENT STATUS: BLOCKED

**Current State**: Backend is production-ready (95% complete) but **critical integration issues prevent deployment**

**Estimated Fix Time**: 3-5 days of focused development  
**Priority**: Must fix integration issues before attempting production deployment

## ⚠️ CRITICAL BLOCKERS - MUST FIX FIRST

These integration issues will prevent normal user functionality in production:

1. **🚨 Authentication Mismatch**: Frontend (NextAuth) vs Backend (API keys) - users can't access data
2. **🚨 API Integration Gap**: Dashboard shows fake data, calls non-existent endpoints
3. **⚠️ CORS Missing**: Production domains not configured for cross-origin requests
4. **⚠️ Data Schema Mismatch**: Frontend/backend expect different data formats

**DO NOT DEPLOY** until these are resolved - the system will appear functional but users cannot access their data.

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

## 🛠️ INTEGRATION FIXES - IMMEDIATE ACTION REQUIRED

**These fixes must be completed in order before any deployment attempt:**

### 🚨 Priority 1: Authentication System Integration (Day 1-2)

**Problem**: Complete authentication disconnect
- Dashboard: NextAuth.js sessions
- API: Expects Bearer API keys
- Result: Login works but no data access

**Solution**: Unify to session-based authentication

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

### 🚨 Priority 2: API Endpoint Integration (Day 2-3)

**Problem**: Dashboard completely non-functional
- Shows hardcoded "0" for all metrics
- Calls non-existent endpoints
- 75% of backend features not exposed

**Solution**: Connect frontend to real API endpoints

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

### ⚠️ Priority 3: CORS Configuration (Day 3-4)

**Problem**: Cross-origin requests will fail in production
- No CORS headers for production domains
- app.deadlink.io cannot call api.deadlink.io

**Solution**: Configure CORS for all domains

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

### ⚠️ Priority 4: Data Schema Alignment (Day 4-5)

**Problem**: Data format mismatches cause parsing errors
- Backend schema != Frontend interfaces
- Analytics data incompatible

**Solution**: Transform API responses to match frontend

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

## 🚀 NEXT STEPS TO DEPLOYMENT

### Immediate Actions (This Week)
1. **Fix authentication integration** - Make frontend/backend auth compatible
2. **Connect dashboard to real APIs** - Replace hardcoded data with live endpoints
3. **Configure CORS properly** - Enable production domain communication
4. **Test end-to-end flow** - Signup → Login → Dashboard → Link creation

### Production Deployment Checklist

### ❌ Integration Prerequisites (MUST COMPLETE FIRST)
- [ ] **Authentication unified** - NextAuth sessions work with API
- [ ] **Dashboard shows real data** - No more hardcoded zeros
- [ ] **API endpoints connected** - Frontend calls correct backend URLs
- [ ] **CORS configured** - app.deadlink.io can call api.deadlink.io

### ✅ Infrastructure Ready (Already Complete)
- [x] **Backend security hardened** - bcrypt, CSRF, rate limiting, session management
- [x] **Database system ready** - Migrations, backups, health checks
- [x] **Monitoring implemented** - Error logging, health checks, alerts
- [x] **Cloudflare resources** - D1 database, KV namespaces configured
- [x] **Environment setup** - Separate dev/staging/production configs

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

## 📋 DEVELOPMENT PRIORITY ORDER

**Start with these tasks in exact order:**

1. **Authentication Integration** (api/src/auth.js + app/src/lib/api.ts)
   - Add session validation to backend auth middleware
   - Update frontend to send session tokens instead of API keys

2. **API Endpoint Updates** (app/src/app/dashboard/*)
   - Replace hardcoded dashboard data with real API calls
   - Update all endpoint URLs to match current backend

3. **CORS Configuration** (api/src/cors-simple.js)
   - Add production domains to allowed origins
   - Test cross-origin requests work

4. **End-to-End Testing**
   - User signup → login → dashboard shows real data → link creation works

**⚠️ DO NOT attempt production deployment until integration issues are resolved!**

The backend infrastructure is solid and secure, but the frontend/backend disconnect will cause user-facing failures in production.

