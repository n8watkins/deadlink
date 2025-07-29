# Dead Link Switchboard - User Setup Guide

This guide contains everything you need to set up and deploy Dead Link Switchboard, a link shortening service with automatic failover capabilities.

## Prerequisites

### Required Accounts
1. **Cloudflare Account** (Free tier works for development)
   - Sign up at https://cloudflare.com
   - You'll need access to:
     - Workers (serverless compute)
     - KV (key-value storage)
     - D1 (SQL database)
     - Analytics Engine
     - Pages (for dashboard hosting)

2. **Stripe Account** (for billing features)
   - Sign up at https://stripe.com
   - Required for Phase 7 (billing/monetization)

3. **Git Repository**
   - GitHub, GitLab, or similar
   - For CI/CD deployment

### Development Tools
- Node.js 18+ and npm
- Git
- Wrangler CLI (Cloudflare's deployment tool)

## Step-by-Step Setup

### 1. Initial Project Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd dead-link-switchboard

# Install dependencies
npm install

# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Cloudflare Configuration

#### A. Create KV Namespaces

```bash
# Create production KV namespace
wrangler kv:namespace create "LINKS"
# Save the ID returned (e.g., "a1b2c3d4e5f6...")

# Create staging KV namespace  
wrangler kv:namespace create "LINKS" --preview
# Save the preview_id returned
```

#### B. Create D1 Database

```bash
# Create the database
wrangler d1 create dead-link-db
# Save the database_id returned
```

#### C. Update wrangler.toml

Replace the placeholder IDs in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "LINKS"
id = "YOUR_KV_ID_HERE"
preview_id = "YOUR_PREVIEW_KV_ID_HERE"

[[d1_databases]]
binding = "DB"
database_name = "dead-link-db"
database_id = "YOUR_D1_ID_HERE"
```

### 3. Database Setup

Run all migrations in order:

```bash
# Run migrations
wrangler d1 execute dead-link-db --file=migrations/001_initial_schema.sql
wrangler d1 execute dead-link-db --file=migrations/002_health_checks.sql
wrangler d1 execute dead-link-db --file=migrations/003_analytics.sql
wrangler d1 execute dead-link-db --file=migrations/004_billing.sql
```

### 4. Environment Variables

Create `.env` file for local development:

```env
# API Configuration
API_KEY_SALT=<generate-random-32-char-string>

# Stripe Configuration (Phase 7)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_FREE=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...

# Notification Configuration (optional)
WEBHOOK_URL=https://your-webhook-endpoint.com
NOTIFICATION_EMAIL=alerts@yourdomain.com

# Health Check Configuration
HEALTH_CHECK_BATCH_SIZE=50
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_RETRIES=2

# Analytics Configuration
BOT_PATTERN_VERSION=1
```

### 5. API Keys Setup

#### Generate Admin API Key

```bash
# Generate a secure API key
node -e "console.log('dl_' + require('crypto').randomBytes(32).toString('hex'))"
```

#### Add to Database

```sql
-- Add via Wrangler D1
wrangler d1 execute dead-link-db --command "INSERT INTO api_keys (key_hash, name, permissions, rate_limit) VALUES ('YOUR_HASHED_KEY', 'Admin Key', 'admin', 10000)"
```

### 6. Domain Setup

#### A. Custom Domain (Production)

1. Add your domain to Cloudflare DNS
2. Configure Workers routes:
   ```bash
   # In wrangler.toml
   routes = [
     { pattern = "deadlink.io/*", zone_name = "deadlink.io" },
     { pattern = "api.deadlink.io/*", zone_name = "deadlink.io" }
   ]
   ```

#### B. Development URLs

Your services will be available at:
- Main app: `https://dead-link-switchboard.{username}.workers.dev`
- Health checks: `https://dead-link-health-check.{username}.workers.dev`
- Dashboard: `https://dead-link-dashboard.pages.dev`

### 7. Stripe Setup (Phase 7)

1. **Create Products and Prices**:
   ```
   Free Plan: $0/month, 1,000 clicks
   Pro Plan: $29/month, 50,000 clicks
   Enterprise: $199/month, 500,000 clicks
   ```

2. **Configure Webhooks**:
   - Endpoint: `https://api.deadlink.io/webhooks/stripe`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

3. **Add Stripe Keys** to environment variables

### 8. WordPress Plugin Setup

1. Build the plugin:
   ```bash
   cd plugins/wordpress
   npm run build
   zip -r dead-link-switchboard.zip .
   ```

2. Install in WordPress:
   - Upload the ZIP file via WordPress admin
   - Activate the plugin
   - Configure with your API key

### 9. Deploy to Production

#### A. Deploy Workers

```bash
# Deploy main worker
wrangler deploy --env production

# Deploy health check worker
wrangler deploy --config wrangler.health.toml --env production

# Deploy dashboard
cd dashboard
npm run build
wrangler pages deploy dist --project-name=dead-link-dashboard
```

#### B. Configure Cron Triggers

Health checks run automatically via cron:
- Production: Every 15 minutes
- Staging: Every 5 minutes

Verify in Cloudflare dashboard: Workers > Your Worker > Triggers

### 10. Production Checklist

Before going live, ensure:

- [ ] All environment variables are set
- [ ] Database migrations are complete
- [ ] API keys are generated and secured
- [ ] Custom domain is configured
- [ ] SSL certificates are active
- [ ] Health check cron is running
- [ ] Stripe webhooks are configured
- [ ] Error alerting is set up
- [ ] Backups are configured

## Security Configuration

### Critical Security Fixes

From the production readiness assessment, implement these immediately:

1. **Replace Hardcoded Salts**:
   ```javascript
   // Bad (current)
   const SALT = 'dead-link-salt-2024';
   
   // Good (use environment variable)
   const SALT = env.API_KEY_SALT;
   ```

2. **Implement Rate Limiting**:
   - Already configured in the code
   - Adjust limits in environment variables as needed

3. **Add Memory Limits**:
   ```javascript
   // In health checks
   const MAX_BATCH_SIZE = 100;
   const MAX_CONCURRENT = 10;
   ```

## Monitoring Setup

### 1. Cloudflare Analytics

Enable Analytics Engine:
```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "dead_link_clicks"
```

### 2. Error Tracking

Configure error notifications:
- Set `WEBHOOK_URL` for real-time alerts
- Set `NOTIFICATION_EMAIL` for email alerts

### 3. Health Dashboard

Access monitoring at:
- `/api/health/stats` - Overall statistics
- `/api/health/link/{slug}` - Individual link history

## Testing Your Setup

### 1. Create Test Link

```bash
curl -X POST https://api.deadlink.io/api/v1/links \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "fallback_urls": ["https://example.org"]
  }'
```

### 2. Test Redirect

```bash
curl -I https://deadlink.io/r/YOUR_SLUG
```

### 3. Verify Health Checks

```bash
curl https://api.deadlink.io/api/health/stats
```

## Troubleshooting

### Common Issues

1. **KV namespace not found**: Ensure IDs in wrangler.toml match created namespaces
2. **D1 errors**: Check migrations ran successfully
3. **API key invalid**: Verify key is hashed correctly with proper salt
4. **Health checks not running**: Check cron trigger configuration
5. **Stripe webhooks failing**: Verify webhook secret and endpoint URL

### Debug Commands

```bash
# Check worker logs
wrangler tail

# Test D1 queries
wrangler d1 execute dead-link-db --command "SELECT * FROM links LIMIT 5"

# List KV keys
wrangler kv:key list --namespace-id=YOUR_KV_ID
```

## Support Resources

- Documentation: `/docs` folder
- Phase guides: `/phases` folder
- API Reference: See phase-2-links-api.md
- Health Check Guide: See phase-3-health-checks.md

## Next Steps

1. Complete basic setup (Phases 0-2)
2. Enable health checks (Phase 3)
3. Add analytics (Phase 4)
4. Deploy dashboard (Phase 5)
5. Install plugins (Phase 6)
6. Enable billing (Phase 7)
7. Launch to production (Phase 8)

Remember to test thoroughly in staging before deploying to production!