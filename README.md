# Dead Links Switchboard - Monorepo

**A comprehensive link management and redirect service that automatically detects and redirects dead/broken links to working alternatives while providing monetization opportunities.**

**Status:** Backend 95% Complete | Frontend Integration Required  
**Deployment Ready:** ✅ Security Hardened | Database Configured | Health Monitoring Active

## 🎯 Application Purpose & Value Proposition

Dead Links Switchboard is a sophisticated link management platform that:

- **Automatically detects dead/broken links** and redirects users to working alternatives
- **Monetizes dead traffic** by redirecting to relevant content with revenue sharing
- **Provides comprehensive analytics** on link performance and user behavior  
- **Offers bulk operations** for managing thousands of links efficiently
- **Supports custom short URLs** and QR code generation
- **Ensures GDPR compliance** with data export and deletion capabilities

## 🏗️ Monorepo Structure

```
deadlinks-switchboard/
├── app/                         # Dashboard application (Next.js 15, React 19)
├── landing/                     # Marketing site (Next.js + Framer Motion)
├── api/                         # Backend API (Cloudflare Workers + D1 + KV)
├── plugin/                      # WordPress integration
└── package.json                 # Monorepo workspace configuration
```

## ✨ Implemented Features

### 🔧 Backend API (95% Complete)
- **Link Management**: Create, update, delete links with custom slugs
- **Bulk Operations**: Handle up to 100 links simultaneously  
- **QR Code Generation**: Dynamic QR codes for any link
- **Health Monitoring**: Automated dead link detection every 5 minutes
- **Analytics Engine**: Track clicks, user agents, referrers, geolocation
- **Security Hardening**: bcrypt passwords, CSRF protection, rate limiting
- **GDPR Compliance**: Data export and account deletion endpoints
- **Error Logging**: Comprehensive error tracking and alerting

### 🖥️ Frontend Components
- **Dashboard App**: Next.js 15 with TypeScript and accessibility testing
- **Marketing Site**: Complete landing page with Hero, Features, Pricing, FAQ
- **WordPress Plugin**: PHP-based integration for WordPress sites

### 🔒 Security & Operations
- **Authentication**: Session-based auth with secure password hashing
- **Database**: D1 SQL database with automated migrations and backups
- **Monitoring**: Health checks with webhook notifications
- **Deployment**: Staging and production environments with CI/CD

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- Cloudflare account (Workers, D1, KV, Pages)

### Installation
```bash
# Clone and install dependencies
git clone <repository-url>
cd deadlinks-switchboard
npm run install-all
```

### Development
```bash
# Start the dashboard app
npm run dev:app              # http://localhost:3000

# Start the marketing site  
npm run dev:landing          # http://localhost:3001

# Start the API (Cloudflare Workers)
npm run dev:api              # http://localhost:8787

# Build all components
npm run build
```

## 🚨 Critical Integration Issues

**The monorepo has significant integration gaps that prevent production deployment:**

### 1. **Authentication Fragmentation**
- **Problem**: Dashboard uses NextAuth sessions, API expects API keys
- **Impact**: Users cannot authenticate properly between frontend and backend
- **Fix Required**: Unify to single session-based auth system

### 2. **API Endpoint Mismatch** 
- **Problem**: Frontend calls outdated endpoints, missing 75% of backend features
- **Impact**: Dashboard shows hardcoded fake data instead of real API responses
- **Fix Required**: Update frontend to use current API endpoints

### 3. **CORS Configuration Missing**
- **Problem**: API not configured for multiple frontend origins
- **Impact**: Cross-origin requests fail between app/landing and API
- **Fix Required**: Configure CORS for app.deadlink.io, deadlink.io domains

### 4. **Hardcoded Dashboard Data**
- **Problem**: App shows "0" values for all metrics instead of real data
- **Impact**: Dashboard is non-functional for actual users
- **Fix Required**: Connect dashboard components to live API endpoints

## 🔧 Development Workflow

### Working with Workspaces
```bash
# Install package in specific workspace
npm install <package> --workspace=app

# Run command in specific workspace  
npm run test --workspace=api

# List all workspaces
npm run workspaces list
```

### Testing
```bash
# Run all tests
npm test

# Accessibility testing (Playwright + Axe)
npm run test:a11y --workspace=app

# API integration tests
npm run test --workspace=api
```

## 🚢 Deployment Status

### ✅ Production Ready Components
- **Backend API**: Fully deployed with security hardening
- **Database**: D1 with automated migrations and backups  
- **Monitoring**: Health checks and error tracking active
- **Security**: bcrypt, CSRF protection, rate limiting implemented

### ⚠️ Integration Required
- **Frontend-Backend Communication**: Authentication and API endpoints
- **CORS Configuration**: Multi-domain setup
- **Dashboard Data Integration**: Replace hardcoded values with live data
- **User Flow**: Landing page → signup → functional dashboard

## 📚 Documentation

- **[User Setup Guide](./userSetup.md)** - Production deployment requirements
- **[Deployment Ready Status](./DEPLOYMENT_READY.md)** - Security and infrastructure status
- **[API Documentation](./api/README.md)** - Complete API reference
- **[Dashboard Guide](./app/docs/dashboard-guide.md)** - Frontend development guide

## 🎯 Next Steps for Production

### **Phase 1: Critical Integration Fixes**
1. **Unify Authentication** - Implement session-based auth across all components
2. **Fix API Endpoints** - Update frontend to call current backend endpoints  
3. **Configure CORS** - Set up proper cross-origin support
4. **Connect Dashboard Data** - Replace hardcoded values with live API calls

### **Phase 2: Feature Completion**
1. **Expose Missing Features** - Add UI for bulk operations, QR codes, custom slugs
2. **GDPR Interface** - Add data export and account deletion to dashboard
3. **Analytics Dashboard** - Connect real analytics data to frontend

### **Phase 3: Production Launch**  
1. **End-to-End Testing** - Verify complete user flows work
2. **Load Testing** - Ensure system handles production traffic
3. **Monitoring Setup** - Configure production alerts and dashboards

---

**Current Status:** 🔴 **Integration Required Before Production**  
**Estimated Fix Time:** 3-5 days for critical integration issues  
**Backend Completeness:** 95% | **Frontend Integration:** 25%