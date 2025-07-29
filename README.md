# Dead Links Switchboard - Monorepo

**Status:** Refactored to Monorepo Structure  
**Backend:** ✅ 95% Complete | **Frontend Integration:** ⚠️ In Progress  
**Last Updated:** $(date)

## 🏗️ Monorepo Structure

This project has been refactored into a monorepo containing all components:

```
deadlinks-switchboard/
├── app/                         # Main dashboard application (Next.js)
├── landing/                     # Marketing landing page (Next.js)
├── api/                         # Backend API (Cloudflare Workers)
├── plugin/                      # WordPress integration plugin
├── docs/                        # Documentation
└── scripts/                     # Build and deployment scripts
```

## ✅ **STRUCTURE COMPLETED**

**Landing Page Resolution:**
- **Primary Landing Page:** `landing/` - Complete marketing site with comprehensive components
- **App Dashboard:** `app/` - Pure dashboard application (redundant marketing components removed)
- **Clean Separation:** Landing page handles marketing, app handles authenticated dashboard experience

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm 8+

### Installation
```bash
# Install all dependencies across workspaces
npm run install-all

# Or just root dependencies
npm install
```

### Development

```bash
# Start the main dashboard app
npm run dev:app

# Start the landing page
npm run dev:landing

# Start the API (Cloudflare Workers)
npm run dev:api

# Start everything (default: main app)
npm run dev
```

### Building

```bash
# Build all workspaces
npm run build

# Build specific components
npm run build:app
npm run build:landing
```

## 📁 Component Details

### 🖥️ App (Publisher Dashboard)
**Location:** `app/`

The main dashboard application for authenticated users. Features:
- Link management interface
- Analytics dashboard with contrast accessibility testing
- User authentication and session management
- Real-time monitoring and health checks
- Playwright-based accessibility testing

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, NextAuth, Playwright

### 🌐 Landing Page
**Location:** `landing/`

Complete marketing website with comprehensive components. Features:
- Hero section and product showcase
- Features, pricing, and testimonials
- FAQ and how-it-works sections
- Footer with links and contact info
- Responsive design and animations

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Framer Motion

### ⚡ API
**Location:** `api/`

Backend API built on Cloudflare Workers with MVP features complete:

```typescript
// Core Features - 95% Complete
POST /api/v1/links              // Create links with custom slugs
POST /api/v1/links/bulk         // Bulk operations (up to 100)
GET  /api/v1/qr/:slug          // QR code generation
PUT  /api/v1/links/:slug       // Link expiration settings

// User Management - Complete
POST /api/auth/reset-password   // Password reset flow
GET  /api/user/data-export     // GDPR data export
POST /api/user/delete-account  // GDPR data deletion
GET  /api/user/usage           // Usage tracking & limits
```

**Tech Stack:** Cloudflare Workers, JavaScript, D1 Database

### 🔌 WordPress Plugin
**Location:** `plugin/`

WordPress integration plugin. Features:
- Easy link integration
- Dashboard widgets
- Automated dead link detection
- Bulk operations

**Tech Stack:** PHP, JavaScript, WordPress API

## 🔧 Development Workflow

### Working with Workspaces

```bash
# Run commands in specific workspace
npm run <command> --workspace=app/publisher-dashboard

# Install dependencies in specific workspace
npm install <package> --workspace=app/publisher-dashboard

# List all workspaces
npm run workspaces list
```

### Cross-Component Development

When developing features that span multiple components:

1. Start relevant services:
   ```bash
   npm run dev:api    # Start API
   npm run dev:app    # Start dashboard
   npm run dev:landing # Start landing page
   ```

2. Test integration points thoroughly

## 🚨 Current Integration Issues

### **Authentication Fragmentation** 
Currently have multiple auth systems that need unification:
- Session-based auth (recommended)
- API key authentication
- Different auth flows in different components

### **Landing Page Architecture** ✅
- Clean separation: `landing/` handles marketing, `app/` handles dashboard
- No duplication: redundant marketing components removed from app
- Unified user flow: landing → signup → dashboard

### **Feature Gaps**
75% of backend MVP features are not accessible through current frontends:
- Custom slugs, QR codes, bulk operations missing from UI
- GDPR compliance features not exposed
- Usage limits and webhook management not implemented

## 🧪 Testing

The monorepo includes comprehensive testing:

```bash
# Run all tests
npm test

# Run accessibility tests (Playwright + Axe)
npm run test:a11y --workspace=app/publisher-dashboard

# Run contrast testing
npx playwright test tests/accessibility.spec.ts --workspace=app/publisher-dashboard
```

### Accessibility Testing
The dashboard includes Playwright-based accessibility testing with:
- WCAG 2.1 AA compliance checking
- Color contrast ratio validation
- Dark mode contrast testing
- Detailed contrast analysis tools

## 🚢 Deployment

### Individual Components

```bash
# Deploy API to Cloudflare
npm run deploy:api

# Build and prepare app for deployment
npm run deploy:app

# Build and prepare landing page
npm run deploy:landing
```

## 🛠️ Development Scripts

```bash
npm run clean          # Clean all node_modules
npm run install-all    # Install all dependencies
npm run lint          # Lint all workspaces
npm run format        # Format all code
npm run type-check    # TypeScript checking
```

## 🎯 Next Steps

### **Phase 1: Landing Page Integration** (Current Priority)
1. Analyze both landing page implementations
2. Merge `landing/dead-link-switchboard-landing/` with `app/publisher-dashboard/marketing/`
3. Create unified routing and user experience
4. Remove duplicate components and code

### **Phase 2: Feature Integration**
1. Connect all MVP API features to dashboard UI
2. Implement missing features (QR codes, bulk ops, custom slugs)
3. Add GDPR compliance interfaces
4. Standardize authentication system

### **Phase 3: Production Ready**
1. Complete testing across all components
2. Finalize deployment configurations
3. Production monitoring and health checks

## 📚 Documentation

- [Dashboard Guide](./docs/dashboard-guide.md)
- [API Documentation](./api/dead-link-switchboard-api/README.md)
- [WordPress Plugin Guide](./plugin/dead-link-wordpress-plugin/README.md)
- [Deployment Guide](./DEPLOYMENT_READY.md)
- [Integration Analysis](./integrations_prog.md)

---

**Current Risk Level:** 🟡 Medium - Monorepo structure created, integration work in progress  
**Estimated Integration Time:** 1-2 weeks for landing page merge + feature integration