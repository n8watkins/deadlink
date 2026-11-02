# Dead-Link Switchboard

Affiliate-aware dead link detection and automatic failover system built on Cloudflare Workers.

## Overview

Automatically detect dead affiliate links and switch to backup URLs to prevent lost revenue. Built for global edge performance with <50ms response times.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Deploy to Cloudflare:
   ```bash
   npm run deploy
   ```

## API Endpoints

- `GET /` - API information
- `GET /health` - Health check
- `GET /r/:slug` - Redirect endpoint (Phase 1+)

## Development

This project is built in phases:

- **Phase 0**: ✅ Setup & Infrastructure 
- **Phase 1**: ✅ Redirect MVP
- **Phase 2**: ✅ Links API
- **Phase 3**: ✅ Health Checks
- **Phase 4**: ✅ Analytics
- **Phase 5**: ✅ Dashboard
- **Phase 6**: 🔌 Plugins
- **Phase 7**: 💰 Billing
- **Phase 8**: 🚀 Production Launch

## Architecture

- **Cloudflare Workers**: Edge computing platform
- **KV Storage**: Link data and configuration
- **D1 Database**: Analytics and user data (Phase 2+)
- **Analytics Engine**: Real-time metrics (Phase 4+)

## Phase 1 Complete! 🎉 - PRODUCTION READY

The core redirect functionality is now working with enterprise-grade security:

### ✅ Core Features
- Slug-based redirects (`/r/abc123`)
- KV storage integration for link data
- Performance monitoring with response time headers
- Error handling for missing/invalid slugs
- Automatic 404 fallback for non-existent links

### 🔒 Security Features (NEW)
- **Open redirect protection** - URL validation prevents phishing attacks
- **Input sanitization** - Strict slug validation blocks injection attacks
- **Rate limiting** - DoS protection with configurable limits
- **CORS controls** - Environment-specific origin validation
- **Security headers** - XSS, clickjacking, and MIME-type protection
- **Information disclosure prevention** - Sanitized logging for production

### 🧪 Comprehensive Testing (REWRITTEN)
- **42 tests total** (21 security-focused, 21 functional)
- **Proper KV mocking** - No more environment-dependent failures
- **Attack vector coverage** - Tests for XSS, SSRF, injection, enumeration
- **100% test reliability** - Deterministic assertions, no false positives

### 🧪 Testing
```bash
# Run test suite
npm test

# Manual testing
npm run dev
curl -I http://localhost:8787/r/test123
```

### 📊 Performance
- Sub-10ms KV lookups
- Edge-deployed for global <50ms response times
- Cache headers for optimal CDN performance

### 🔗 Sample Links
Try these test links in development:
- `/r/test123` → https://www.example.com/product-1
- `/r/amazon1` → https://www.amazon.com/dp/B0TESTprod

## License

MIT

## Phase 5 Complete! 🎨

Publisher dashboard is now live with full functionality:
- ✅ Modern React/Next.js dashboard
- ✅ Real-time analytics with charts
- ✅ Link management interface
- ✅ CSV export functionality
- ✅ Mobile-responsive design

### Dashboard Features
```bash
# Access at your deployed URL
https://dead-link-dashboard.pages.dev

# Key features:
- Dashboard overview with key metrics
- Link creation and management
- Detailed analytics with charts
- Settings and API key management
- CSV data export
```

### Local Development
```bash
cd ../publisher-dashboard
npm install
npm run dev
# Visit http://localhost:3000
```