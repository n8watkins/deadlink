# DeadLink Switchboard - Publisher Dashboard

Modern React/Next.js dashboard for managing affiliate links with automatic failover.

## Features

- 🎛️ **Link Management** - Create, edit, and manage your shortened links
- 📊 **Real-time Analytics** - Track clicks, geographic data, and bot detection
- 📈 **Visual Charts** - Line charts, pie charts, and data tables
- 📱 **Mobile Responsive** - Works on all device sizes
- 🔐 **API Key Authentication** - Secure access with personal API keys
- 📄 **CSV Export** - Download analytics data for external analysis

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open dashboard:**
   Visit http://localhost:3000 and enter your API key

## Building for Production

```bash
# Create optimized static build
npm run build

# The built files will be in the `out` directory
```

## Deployment to Cloudflare Pages

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy to Cloudflare Pages:**
   ```bash
   npx wrangler pages deploy out --project-name=dead-link-dashboard
   ```

## Environment Variables

Set these in your deployment environment:

- `NEXT_PUBLIC_API_BASE_URL` - Your API endpoint (e.g., https://api.deadlink.io)
- `NEXT_PUBLIC_APP_NAME` - Application name
- `NEXT_PUBLIC_APP_URL` - Dashboard URL

## Dashboard Pages

### Overview Dashboard
- Total links and click statistics
- Human vs bot traffic breakdown
- Click trends over time
- Top performing links table

### Links Management
- Create new links with fallback URLs
- Edit existing links and status
- Copy short URLs to clipboard
- Delete links with confirmation

### Analytics
- Detailed metrics for individual links or overview
- Time range filtering (7d, 30d, 90d)
- Geographic breakdown and charts
- CSV export functionality

### Settings
- API key management and regeneration
- Bot blocking configuration
- Notification preferences
- Webhook URL configuration

## Phase 5 Complete! 🎨

✅ Modern React/Next.js dashboard  
✅ Real-time analytics with charts  
✅ Link management interface  
✅ CSV export functionality  
✅ Mobile-responsive design
