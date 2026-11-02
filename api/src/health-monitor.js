// Phase 3: Health Check Monitoring Dashboard
// API endpoints for monitoring health check system

import { Router } from 'itty-router';
import { withCORS, withAuth, withRateLimit, errorResponse, successResponse } from './middleware.js';

const router = Router();

// Apply CORS to all routes
router.all('*', withCORS);

// Get health check statistics
router.get('/api/health/stats', withAuth, withRateLimit, async (request, env) => {
  try {
    const timeRange = new URL(request.url).searchParams.get('range') || '24h';
    const since = getTimestamp(timeRange);
    
    // Overall statistics
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(DISTINCT slug) as total_links,
        COUNT(CASE WHEN new_status = 'dead' THEN 1 END) as dead_links,
        COUNT(CASE WHEN new_status LIKE 'fallback%' THEN 1 END) as failover_links,
        COUNT(CASE WHEN old_status != 'live' AND new_status = 'live' THEN 1 END) as recovered_links
      FROM link_status_changes
      WHERE changed_at > ?
    `).bind(since).first();
    
    // Recent changes
    const recentChanges = await env.DB.prepare(`
      SELECT 
        slug,
        old_status,
        new_status,
        changed_at,
        reason
      FROM link_status_changes
      WHERE changed_at > ?
      ORDER BY changed_at DESC
      LIMIT 50
    `).bind(since).all();
    
    // Health check performance
    const performance = await env.DB.prepare(`
      SELECT 
        AVG(duration_ms) as avg_duration,
        MIN(duration_ms) as min_duration,
        MAX(duration_ms) as max_duration,
        COUNT(*) as total_runs
      FROM health_check_runs
      WHERE run_at > ?
    `).bind(since).first();
    
    return successResponse({
      timeRange,
      since: new Date(since).toISOString(),
      stats: stats || {
        total_links: 0,
        dead_links: 0,
        failover_links: 0,
        recovered_links: 0
      },
      recentChanges: recentChanges?.results || [],
      performance: performance || {
        avg_duration: 0,
        min_duration: 0,
        max_duration: 0,
        total_runs: 0
      }
    }, 200, request);
  } catch (error) {
    console.error('Error getting health stats:', error);
    return errorResponse('Failed to get health check statistics', 'STATS_FAILED', 500, request);
  }
});

// Get link health history
router.get('/api/health/link/:slug', withAuth, withRateLimit, async (request, env) => {
  try {
    const { slug } = request.params;
    
    // Get status change history
    const history = await env.DB.prepare(`
      SELECT 
        old_status,
        new_status,
        changed_at,
        reason
      FROM link_status_changes
      WHERE slug = ?
      ORDER BY changed_at DESC
      LIMIT 100
    `).bind(slug).all();
    
    // Get current link data
    const currentData = await env.LINKS.get(slug, 'json');
    
    if (!currentData) {
      return errorResponse('Link not found', 'NOT_FOUND', 404, request);
    }
    
    // Verify ownership
    if (currentData.owner_id !== request.user.id) {
      return errorResponse('Access denied', 'FORBIDDEN', 403, request);
    }
    
    return successResponse({
      slug,
      current: currentData,
      history: history?.results || []
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting link health history:', error);
    return errorResponse('Failed to get link health history', 'HISTORY_FAILED', 500, request);
  }
});

// Trigger manual health check
router.post('/api/health/check', withAuth, withRateLimit, async (request, env, ctx) => {
  try {
    const { slugs } = await request.json();
    
    if (!slugs || !Array.isArray(slugs)) {
      return errorResponse('Invalid request: slugs array required', 'INVALID_REQUEST', 400, request);
    }
    
    // Limit to 50 links per manual check
    if (slugs.length > 50) {
      return errorResponse('Too many links: maximum 50 per request', 'TOO_MANY_LINKS', 400, request);
    }
    
    // Verify ownership of all links
    for (const slug of slugs) {
      const linkData = await env.LINKS.get(slug, 'json');
      if (!linkData) {
        return errorResponse(`Link not found: ${slug}`, 'NOT_FOUND', 404, request);
      }
      if (linkData.owner_id !== request.user.id) {
        return errorResponse(`Access denied for link: ${slug}`, 'FORBIDDEN', 403, request);
      }
    }
    
    // Queue health checks (import the checkLink function from health-check.js)
    ctx.waitUntil(
      Promise.all(slugs.map(slug => checkSingleLink(slug, env)))
    );
    
    return successResponse({
      message: `Queued health check for ${slugs.length} links`,
      slugs,
      estimated_completion: new Date(Date.now() + slugs.length * 1000).toISOString()
    }, 200, request);
    
  } catch (error) {
    console.error('Error triggering manual health check:', error);
    return errorResponse('Failed to trigger health check', 'TRIGGER_FAILED', 500, request);
  }
});

// Get system-wide health check status (admin only in the future)
router.get('/api/health/system', withAuth, withRateLimit, async (request, env) => {
  try {
    // Get overall system stats
    const systemStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_health_runs,
        AVG(links_checked) as avg_links_per_run,
        MAX(run_at) as last_run_at,
        AVG(duration_ms) as avg_duration_ms
      FROM health_check_runs
      WHERE run_at > ?
    `).bind(Date.now() - 86400000).first(); // Last 24 hours
    
    // Get status distribution
    const statusDistribution = await env.DB.prepare(`
      SELECT 
        new_status,
        COUNT(*) as count
      FROM link_status_changes
      WHERE changed_at > ?
      GROUP BY new_status
      ORDER BY count DESC
    `).bind(Date.now() - 86400000).all();
    
    return successResponse({
      system: systemStats || {
        total_health_runs: 0,
        avg_links_per_run: 0,
        last_run_at: null,
        avg_duration_ms: 0
      },
      status_distribution: statusDistribution?.results || []
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting system health status:', error);
    return errorResponse('Failed to get system health status', 'SYSTEM_FAILED', 500, request);
  }
});

// Helper function to convert time range to timestamp
function getTimestamp(range) {
  const now = Date.now();
  const ranges = {
    '1h': 3600000,
    '6h': 21600000,
    '24h': 86400000,
    '7d': 604800000,
    '30d': 2592000000
  };
  return now - (ranges[range] || ranges['24h']);
}

// Helper function for manual health checks
async function checkSingleLink(slug, env) {
  try {
    // Get link data
    const linkData = await env.LINKS.get(slug, 'json');
    if (!linkData) return;
    
    // Simple URL check with shorter timeout for manual checks
    const isAlive = await checkUrl(linkData.active_url, { timeout: 3000, maxRetries: 1 });
    
    // Update last_checked timestamp
    linkData.last_checked = Date.now();
    
    // If URL is dead and we have fallbacks, try them
    if (!isAlive && linkData.status === 'live' && linkData.fallback_urls?.length > 0) {
      for (let i = 0; i < linkData.fallback_urls.length; i++) {
        const fallbackUrl = linkData.fallback_urls[i];
        const fallbackAlive = await checkUrl(fallbackUrl, { timeout: 3000, maxRetries: 1 });
        
        if (fallbackAlive) {
          linkData.active_url = fallbackUrl;
          linkData.status = `fallback_${i + 1}`;
          linkData.status_changed_at = Date.now();
          
          // Log the change
          await env.DB.prepare(
            'INSERT INTO link_status_changes (slug, old_status, new_status, changed_at, reason) VALUES (?, ?, ?, ?, ?)'
          ).bind(slug, 'live', `fallback_${i + 1}`, Date.now(), 'Manual health check').run();
          
          break;
        }
      }
    }
    
    // Save updated data
    await env.LINKS.put(slug, JSON.stringify(linkData));
    
  } catch (error) {
    console.error(`Error in manual check for ${slug}:`, error);
  }
}

// Simple URL checker for manual checks
async function checkUrl(url, config = {}) {
  const timeout = config.timeout || 5000;
  const maxRetries = config.maxRetries || 2;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'DeadLinkSwitchboard/1.0 (+https://deadlink.io/bot)'
        }
      });
      
      clearTimeout(timeoutId);
      
      // Consider 2xx and 3xx as alive
      if (response.status >= 200 && response.status < 400) {
        return true;
      }
      
      // 404/410 are definitely dead
      if (response.status === 404 || response.status === 410) {
        return false;
      }
      
      // Retry on 5xx errors
      if (response.status >= 500 && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      return false;
      
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      return false;
    }
  }
  
  return false;
}

export default {
  fetch: router.handle
};