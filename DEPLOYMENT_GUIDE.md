# 🚀 Dead Link Switchboard - Deployment Guide

## ✅ Status: READY FOR DEPLOYMENT

All critical integration issues have been resolved. The system is production-ready.

## What You Need

### 1. Cloudflare Account Setup
- **Cloudflare account** with Workers/Pages enabled
- **Domain name** (e.g., `yoursite.com`)

### 2. Required Resources

Create these Cloudflare resources:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create production database
wrangler d1 create dead-link-db-prod

# Create production KV namespaces
wrangler kv:namespace create "LINKS" --env production
wrangler kv:namespace create "RATE_LIMIT" --env production
```

### 3. Update Configuration

Edit `api/wrangler.prod.toml` with the IDs returned above:

```toml
[[d1_databases]]
binding = "DB"
database_id = "YOUR_DATABASE_ID_HERE"

[[kv_namespaces]]
binding = "LINKS"
id = "YOUR_LINKS_KV_ID_HERE"

[[kv_namespaces]]
binding = "RATE_LIMIT" 
id = "YOUR_RATE_LIMIT_KV_ID_HERE"
```

### 4. Set Up Database

```bash
cd api
./scripts/migrate.sh production
```

### 5. Deploy

```bash
# Deploy API
cd api
wrangler deploy --env production

# Deploy Dashboard
cd ../app
npm run build
wrangler pages deploy out --project-name=your-dashboard

# Deploy Landing Page
cd ../landing
npm run build
wrangler pages deploy .next --project-name=your-landing
```

### 6. Configure DNS

In Cloudflare DNS, point:
- `yoursite.com` → Landing Page
- `app.yoursite.com` → Dashboard
- `api.yoursite.com` → API Worker

## That's It!

Your Dead Link Switchboard is now live at:
- **Landing**: `https://yoursite.com`
- **Dashboard**: `https://app.yoursite.com` 
- **API**: `https://api.yoursite.com`

## Clean Up Unnecessary Files

These MDs can be deleted after deployment:
- `DEPLOYMENT_READY.md` ✅ (outdated status)
- `followup.md` ✅ (development notes)
- `integrations_prog.md` ✅ (development notes)
- `dashboard-api-integration.md` ✅ (integration already complete)
- `plan.md` ✅ (development planning)
- Most files in `/phases/` ✅ (implementation done)

Keep only:
- `README.md` (project overview)
- `userSetup.md` (detailed reference - can be simplified later)
- This `DEPLOYMENT_GUIDE.md`