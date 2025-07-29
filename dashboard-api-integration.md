# Dashboard Live API Integration - Implementation Guide

## Overview
This document outlines the remaining work needed to connect the dashboard frontend to live API data. The critical integration issues (authentication, CORS, MVP endpoints) have been resolved, but several dashboard components still show placeholder data.

## Status Summary
- ✅ **Authentication Integration**: Session-based auth implemented across frontend/backend
- ✅ **CORS Configuration**: Multi-origin support configured for production domains
- ✅ **MVP API Endpoints**: Missing endpoints added to support frontend calls
- 🟡 **Dashboard Components**: Many still show hardcoded data instead of live API responses

## Components Requiring Live API Integration

### 1. Dashboard Overview (`/app/src/app/dashboard/page.tsx`)

**Current State**: Shows hardcoded "0" values for all metrics

**Required API Calls**:
```typescript
// Replace hardcoded stats with live data
useEffect(() => {
  const fetchDashboardStats = async () => {
    const response = await apiClient.getOverviewAnalytics(30);
    if (response.data) {
      setStats({
        totalLinks: response.data.totalLinks,
        totalClicks: response.data.totalClicks,
        uniqueVisitors: response.data.uniqueCountries,
        conversionRate: calculateConversionRate(response.data)
      });
    }
  };
  
  fetchDashboardStats();
}, []);
```

**API Endpoint**: `GET /api/v1/analytics/overview?days=30`
- Status: ✅ Implemented in MVP API
- Returns: `{ totalLinks, totalClicks, humanClicks, botClicks, uniqueCountries, dailyTrends, topLinks }`

### 2. Links Management (`/app/src/app/dashboard/links/page.tsx`)

**Current State**: Shows mock data with placeholder links

**Required API Calls**:
```typescript
// Replace mock links with real data
useEffect(() => {
  const fetchUserLinks = async () => {
    const response = await apiClient.getLinks(currentPage, 20);
    if (response.data) {
      setLinks(response.data.links);
      setTotalPages(Math.ceil(response.data.total / 20));
    }
  };
  
  fetchUserLinks();
}, [currentPage]);
```

**API Endpoint**: `GET /api/v1/links?page=1&limit=20`
- Status: ✅ Implemented in MVP API  
- Returns: `{ links: Link[], total: number }`

### 3. Analytics Page (`/app/src/app/dashboard/analytics/page.tsx`)

**Current State**: Shows hardcoded chart data and metrics

**Required API Calls**:
```typescript
// Fetch real analytics data
useEffect(() => {
  const fetchAnalytics = async () => {
    const overviewResponse = await apiClient.getOverviewAnalytics(dateRange);
    const linksResponse = await apiClient.getLinks(1, 10); // Top 10 links
    
    if (overviewResponse.data) {
      setAnalyticsData({
        totalClicks: overviewResponse.data.totalClicks,
        humanClicks: overviewResponse.data.humanClicks,
        botClicks: overviewResponse.data.botClicks,
        dailyTrends: overviewResponse.data.dailyTrends,
        topLinks: overviewResponse.data.topLinks
      });
    }
  };
  
  fetchAnalytics();
}, [dateRange]);
```

**API Endpoints**:
- `GET /api/v1/analytics/overview?days=30` - ✅ Implemented
- `GET /api/v1/analytics/link/:slug?days=30` - ✅ Implemented

### 4. Link Creation Forms

**Current State**: Forms exist but may not be properly connected

**Required API Calls**:
```typescript
// Create new link
const handleCreateLink = async (formData) => {
  const response = await apiClient.createLink(formData.url, formData.fallbackUrls);
  if (response.data) {
    // Refresh links list
    router.push('/dashboard/links');
  } else {
    setError(response.error);
  }
};
```

**API Endpoint**: `POST /api/v1/links`
- Status: ✅ Implemented in MVP API
- Payload: `{ url: string, fallback_urls: string[] }`

## Database Schema Integration

### Current API Database Fields vs Frontend Expectations

**Links Table Schema** (from backend):
```sql
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  fallback_1 TEXT,
  fallback_2 TEXT, 
  fallback_3 TEXT,
  status TEXT DEFAULT 'live',
  owner_id TEXT,
  clicks INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  last_clicked INTEGER,
  expires_at INTEGER
);
```

**Frontend Interface** (from `app/src/lib/api.ts`):
```typescript
export interface Link {
  slug: string;
  primary_url: string;      // Maps to 'url'
  active_url: string;       // Computed based on status
  fallback_urls: string[];  // Maps to [fallback_1, fallback_2, fallback_3]
  status: 'live' | 'dead' | 'fallback_1' | 'fallback_2' | 'paused';
  created_at: number;
  updated_at: number;
  clicks: number;
}
```

**Action Required**: Update API responses to match frontend interface:

```javascript
// In /api/src/index-mvp.js, transform database results:
const transformLinkForFrontend = (dbLink) => ({
  slug: dbLink.slug,
  primary_url: dbLink.url,
  active_url: getActiveUrl(dbLink), // Based on status
  fallback_urls: [dbLink.fallback_1, dbLink.fallback_2, dbLink.fallback_3].filter(Boolean),
  status: dbLink.status,
  created_at: dbLink.created_at,
  updated_at: dbLink.updated_at,
  clicks: dbLink.clicks
});
```

## Analytics Data Enhancement

**Current Implementation**: Returns empty/zero data
**Required Enhancement**: Implement actual analytics queries

```javascript
// In /api/src/index-mvp.js, enhance analytics endpoints:

router.get('/api/v1/analytics/overview', requireAuth, async (request, env) => {
  try {
    // Get actual statistics from database
    const totalLinksResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM links WHERE owner_id = ?'
    ).bind(request.userId).first();
    
    const totalClicksResult = await env.DB.prepare(
      'SELECT SUM(clicks) as total FROM links WHERE owner_id = ?'  
    ).bind(request.userId).first();
    
    const topLinksResult = await env.DB.prepare(
      'SELECT slug, url, clicks FROM links WHERE owner_id = ? ORDER BY clicks DESC LIMIT 10'
    ).bind(request.userId).all();
    
    const analytics = {
      totalLinks: totalLinksResult.count,
      totalClicks: totalClicksResult.total || 0,
      humanClicks: Math.floor((totalClicksResult.total || 0) * 0.8), // Estimate
      botClicks: Math.floor((totalClicksResult.total || 0) * 0.2),   // Estimate
      uniqueCountries: 0, // Requires geo tracking implementation
      dailyTrends: [], // Requires daily analytics table
      topLinks: topLinksResult.results.map(transformLinkForFrontend)
    };
    
    return new Response(JSON.stringify(analytics), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

## Implementation Priority

### Phase 1: Critical Dashboard Data (High Priority)
1. **Dashboard Overview Stats** - Replace hardcoded zeros with real link/click counts
2. **Links List** - Show actual user links instead of mock data
3. **Link Creation** - Ensure forms properly create and save links

### Phase 2: Analytics Enhancement (Medium Priority)  
1. **Basic Analytics** - Real click counts and top links
2. **Link Status Updates** - Allow users to pause/activate links
3. **Error Handling** - Proper error states for failed API calls

### Phase 3: Advanced Features (Low Priority)
1. **Daily Trends Charts** - Requires analytics tracking table
2. **Geographic Analytics** - Requires geo-IP implementation
3. **Real-time Updates** - WebSocket or polling for live data

## Testing Checklist

### Before Implementation
- [ ] API endpoints return 200 status codes
- [ ] Database has sample data for testing
- [ ] Authentication works with session tokens
- [ ] CORS allows requests from dashboard domain

### After Implementation
- [ ] Dashboard shows real user data (not zeros)
- [ ] Links list displays actual user links
- [ ] Link creation works end-to-end
- [ ] Analytics show real click counts
- [ ] Error states display properly
- [ ] Loading states work correctly

## Development Commands

```bash
# Start API development server
cd api && npm run dev

# Start dashboard development server  
cd app && npm run dev

# Test API endpoints directly
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" http://localhost:8787/api/v1/links

# Build and test production builds
npm run build-all
```

## Next Steps

1. **Update API Response Transformations**: Ensure backend returns data in format frontend expects
2. **Replace Hardcoded Data**: Update dashboard components to use live API calls
3. **Implement Error Handling**: Add proper loading/error states 
4. **Test User Flows**: Verify signup → login → create link → view analytics works end-to-end
5. **Add Real Analytics**: Enhance analytics endpoints with actual database queries

---

**Status**: Ready for implementation. All critical integration issues resolved.