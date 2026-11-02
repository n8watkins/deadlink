// Dead Link Switchboard - Unified Worker
// Phase 2: Combines redirect service (Phase 1) + Links API (Phase 2)

import { Router } from 'itty-router';
import { nanoid } from 'nanoid';
import { withCORS, withAuth, withRateLimit, withRequestSizeLimit, validateLinkInput, errorResponse, successResponse } from './middleware.js';
import { checkLinkLimit } from './auth.js';
import { isValidRedirectUrl } from './security.js';
import { analyzeRequest, logClickAnalytics, shouldBlockBot, getBotDetectionStats } from './bot-detection.js';
import { getDashboard } from './analytics-dashboard.js';
import { SecurityManager } from './security-hardening.js';

// Create router instance
const router = Router();

// Apply CORS to all routes
router.all('*', withCORS);

// ==================== PHASE 1: REDIRECT SERVICE ====================

// Health check endpoint (no auth required)
router.get('/health', (request) => {
  return successResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'dead-link-switchboard',
    version: '2.0.0'
  }, 200, request);
});

// Main info endpoint (no auth required)
router.get('/', (request) => {
  return successResponse({
    message: 'Dead-Link Switchboard',
    version: '2.0.0',
    documentation: 'https://docs.deadlink.io',
    endpoints: {
      health: '/health',
      redirect: '/r/:slug',
      api: '/api/v1/*'
    }
  }, 200, request);
});

// Redirect endpoint (no auth required - this is the public redirect service)
router.get('/r/:slug', handleRedirect);

// ==================== PHASE 2: LINKS API ====================

// Protected API routes with request size limits
router.post('/api/v1/links', withRequestSizeLimit, withAuth, withRateLimit, createLink);
router.get('/api/v1/links/:slug', withAuth, withRateLimit, getLink);
router.get('/api/v1/links', withAuth, withRateLimit, listLinks);
router.put('/api/v1/links/:slug', withRequestSizeLimit, withAuth, withRateLimit, updateLink);
router.delete('/api/v1/links/:slug', withAuth, withRateLimit, deleteLink);

// User endpoints
router.get('/api/v1/user/profile', withAuth, withRateLimit, getUserProfile);
router.get('/api/v1/user/stats', withAuth, withRateLimit, getUserStats);

// Health check monitoring endpoints (Phase 3)
router.get('/api/health/stats', withAuth, withRateLimit, getHealthStats);
router.get('/api/health/link/:slug', withAuth, withRateLimit, getLinkHealthHistory);
router.post('/api/health/check', withAuth, withRateLimit, triggerManualHealthCheck);
router.get('/api/health/system', withAuth, withRateLimit, getSystemHealthStatus);

// Analytics endpoints (Phase 4)
router.get('/api/v1/analytics/link/:slug', withAuth, withRateLimit, getLinkAnalytics);
router.get('/api/v1/analytics/overview', withAuth, withRateLimit, getAnalyticsOverview);
router.get('/api/v1/analytics/realtime', withAuth, withRateLimit, getRealtimeAnalytics);
router.get('/api/v1/analytics/export', withAuth, withRateLimit, exportAnalytics);
router.get('/api/v1/analytics/bot-stats', withAuth, withRateLimit, getBotStats);
router.get('/api/v1/analytics/dashboard', withAuth, withRateLimit, getDashboard);

// 404 for unmatched routes
router.all('*', (request) => {
  return errorResponse('Not Found', 'NOT_FOUND', 404, request);
});

// Main worker handler
export default {
  async fetch(request, env, ctx) {
    try {
      return await router.handle(request, env, ctx);
    } catch (error) {
      console.error('Unhandled error:', error);
      return errorResponse('Internal Server Error', 'INTERNAL_ERROR', 500, request);
    }
  },
};

// ==================== PHASE 1 HANDLERS ====================

// Simple rate limiting using in-memory storage (for demo)
const rateLimitMap = new Map();

function checkRedirectRateLimit(clientIP, env) {
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = parseInt(env.RATE_LIMIT || '100');
  
  const key = clientIP;
  const currentWindow = Math.floor(now / windowMs);
  const clientData = rateLimitMap.get(key) || { window: currentWindow, count: 0 };
  
  // Reset counter if we're in a new window
  if (clientData.window < currentWindow) {
    clientData.window = currentWindow;
    clientData.count = 0;
  }
  
  clientData.count++;
  rateLimitMap.set(key, clientData);
  
  return clientData.count <= maxRequests;
}

function isValidSlug(slug) {
  // Length limits
  if (!slug || slug.length === 0 || slug.length > 100) {
    return false;
  }
  
  // Decode URL encoding to check for malicious patterns
  let decodedSlug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    return false; // Invalid URL encoding
  }
  
  // Only allow alphanumeric characters, hyphens, and underscores in original slug
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return false;
  }
  
  // Block directory traversal patterns (both encoded and decoded)
  if (slug.includes('..') || slug.includes('./') || slug.includes('../') ||
      decodedSlug.includes('..') || decodedSlug.includes('./') || decodedSlug.includes('../')) {
    return false;
  }
  
  // Block reserved words
  const reserved = ['admin', 'api', 'www', 'mail', 'ftp', 'root', 'test', 'dev'];
  if (reserved.includes(slug.toLowerCase()) || reserved.includes(decodedSlug.toLowerCase())) {
    return false;
  }
  
  return true;
}

async function handleRedirect(request, env, ctx) {
  const startTime = Date.now();
  const { slug } = request.params;
  
  // Basic rate limiting for redirects
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                  request.headers.get('X-Forwarded-For') || 
                  'unknown';
  
  if (!checkRedirectRateLimit(clientIP, env)) {
    return new Response('Rate Limit Exceeded', { 
      status: 429,
      headers: { 
        'Content-Type': 'text/plain',
        'Retry-After': '60',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + 60000)
      }
    });
  }
  
  // Security: Validate slug format
  if (!isValidSlug(slug)) {
    console.log(`Invalid slug format: ${slug}`);
    return new Response('Invalid Request', { 
      status: 400,
      headers: { 
        'content-type': 'text/plain',
        'x-response-time': `${Date.now() - startTime}ms`
      }
    });
  }
  
  console.log(`Processing redirect for slug: ${slug}`);
  
  try {
    // Check if KV is available
    if (!env.LINKS) {
      console.log(`KV namespace not available for slug: ${slug}`);
      return Response.redirect(
        env.FALLBACK_404_URL || 'https://example.com/404', 
        302
      );
    }
    
    // Fetch link data from KV with timing
    const kvStart = Date.now();
    const linkData = await env.LINKS.get(slug, 'json');
    const kvTime = Date.now() - kvStart;
    
    if (!linkData) {
      console.log(`Slug not found: ${slug} (KV lookup: ${kvTime}ms)`);
      return Response.redirect(
        env.FALLBACK_404_URL || 'https://example.com/404', 
        302
      );
    }
    
    // Check if link is active
    if (linkData.status === 'disabled') {
      console.log(`Link disabled: ${slug}`);
      return new Response('Link Disabled', { 
        status: 410,
        headers: {
          'content-type': 'text/plain',
          'x-response-time': `${Date.now() - startTime}ms`
        }
      });
    }
    
    // Security: Validate redirect URL to prevent open redirect attacks
    if (!isValidRedirectUrl(linkData.active_url, env)) {
      console.log(`Invalid redirect URL blocked: ${slug} -> ${linkData.active_url}`);
      return Response.redirect(
        env.FALLBACK_404_URL || 'https://example.com/404', 
        302
      );
    }
    
    // Analyze request for bot detection (Phase 4)
    const analytics = await analyzeRequest(request, env);
    
    // Check if bot should be blocked
    if (shouldBlockBot(analytics, env)) {
      console.log(`Bot blocked: ${slug}, score: ${analytics.botScore}`);
      return new Response('Access Denied', { 
        status: 403,
        headers: {
          'Content-Type': 'text/plain',
          'X-Bot-Score': analytics.botScore.toString(),
          'X-Bot-Category': analytics.category,
          'x-response-time': `${Date.now() - startTime}ms`
        }
      });
    }
    
    // Record click in analytics (async, don't wait)
    ctx.waitUntil(recordClick(env, slug, request, linkData.active_url, linkData));
    
    // Log successful redirect (sanitized in production)
    if (env.ENVIRONMENT === 'development') {
      console.log(`Redirecting ${slug} to ${linkData.active_url} (KV: ${kvTime}ms, Bot Score: ${analytics.botScore})`);
    } else {
      console.log(`Redirect processed: ${slug} (KV: ${kvTime}ms, Bot: ${analytics.category})`);
    }
    
    // Perform redirect with enhanced headers
    return new Response(null, {
      status: 302,
      headers: {
        'Location': linkData.active_url,
        'Cache-Control': 'public, max-age=3600',
        'x-response-time': `${Date.now() - startTime}ms`,
        'x-kv-time': `${kvTime}ms`,
        'x-bot-score': analytics.botScore.toString(),
        'x-bot-category': analytics.category,
        'x-link-status': linkData.status
      }
    });
    
  } catch (error) {
    console.error(`Error processing redirect for ${slug}:`, error);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: { 
        'content-type': 'text/plain',
        'x-response-time': `${Date.now() - startTime}ms`
      }
    });
  }
}

// Record click analytics with bot detection (Phase 4)
async function recordClick(env, slug, request, redirectUrl, linkData) {
  try {
    if (!env.DB) return; // Skip if D1 not available
    
    // Analyze request for bot detection and analytics
    const analytics = await analyzeRequest(request, env);
    
    // Log comprehensive analytics
    await logClickAnalytics(slug, linkData, analytics, env);
    
    // Also log to legacy clicks table for backward compatibility
    const clickData = {
      slug,
      clicked_at: analytics.timestamp,
      ip_hash: analytics.ip,
      country: analytics.country,
      user_agent: sanitizeHeader(request.headers.get('User-Agent')),
      referrer: sanitizeHeader(request.headers.get('Referer')),
      success: true,
      redirect_url: redirectUrl
    };
    
    await env.DB.prepare(`
      INSERT INTO clicks (slug, clicked_at, ip_hash, country, user_agent, referrer, success, redirect_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      clickData.slug,
      clickData.clicked_at,
      clickData.ip_hash,
      clickData.country,
      clickData.user_agent,
      clickData.referrer,
      clickData.success,
      clickData.redirect_url
    ).run();
    
    // Return analytics for response headers
    return analytics;
    
  } catch (error) {
    console.error('Error recording click:', error);
    return null;
  }
}

// Security hardening (Phase 8) - imported at top

// Initialize security manager
let securityManager;

// Hash IP for privacy using cryptographically secure hash (FIXED: Phase 7 Critical Issue #1)
async function hashIP(ip, env) {
  if (!securityManager) {
    securityManager = new SecurityManager(env);
  }
  return await securityManager.secureHash(ip, 'ip_address');
}

// Sanitize header values to prevent injection attacks
function sanitizeHeader(header, maxLength = 255) {
  if (!header) return null;
  // Remove potentially dangerous characters and control chars
  const sanitized = header.replace(/[<>\"'&\x00-\x1f\x7f-\x9f]/g, '');
  return sanitized.substring(0, maxLength);
}

// ==================== PHASE 3 HANDLERS ====================

/**
 * Get health check statistics
 */
async function getHealthStats(request, env, ctx) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '24h';
    
    // Calculate time range
    let startTime;
    switch (timeRange) {
      case '1h': startTime = Date.now() - (60 * 60 * 1000); break;
      case '24h': startTime = Date.now() - (24 * 60 * 60 * 1000); break;
      case '7d': startTime = Date.now() - (7 * 24 * 60 * 60 * 1000); break;
      case '30d': startTime = Date.now() - (30 * 24 * 60 * 60 * 1000); break;
      default: startTime = Date.now() - (24 * 60 * 60 * 1000);
    }
    
    // Get health check runs
    const runs = await env.DB.prepare(`
      SELECT COUNT(*) as total_runs, AVG(duration_ms) as avg_duration, SUM(links_checked) as total_checks
      FROM health_check_runs 
      WHERE run_at > ?
    `).bind(startTime).first();
    
    // Get status distribution
    const statusCounts = await env.DB.prepare(`
      SELECT 
        CASE 
          WHEN status = 'live' THEN 'live'
          WHEN status LIKE 'fallback%' THEN 'fallback'
          WHEN status = 'dead' THEN 'dead'
          ELSE 'other'
        END as status_group,
        COUNT(*) as count
      FROM links 
      WHERE owner_id = ? AND status != 'deleted'
      GROUP BY status_group
    `).bind(request.user.id).all();
    
    // Get recent status changes
    const recentChanges = await env.DB.prepare(`
      SELECT COUNT(*) as changes
      FROM link_status_changes lsc
      JOIN links l ON lsc.slug = l.slug
      WHERE l.owner_id = ? AND lsc.changed_at > ?
    `).bind(request.user.id, startTime).first();
    
    return successResponse({
      time_range: timeRange,
      performance: {
        total_runs: runs?.total_runs || 0,
        avg_duration_ms: Math.round(runs?.avg_duration || 0),
        total_checks: runs?.total_checks || 0
      },
      status_distribution: statusCounts.results.reduce((acc, row) => {
        acc[row.status_group] = row.count;
        return acc;
      }, {}),
      recent_changes: recentChanges?.changes || 0
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting health stats:', error);
    return errorResponse('Failed to get health statistics', 'HEALTH_STATS_FAILED', 500, request);
  }
}

/**
 * Get health history for specific link
 */
async function getLinkHealthHistory(request, env, ctx) {
  try {
    const { slug } = request.params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    
    // Verify link ownership
    const linkData = await env.LINKS.get(slug, 'json');
    if (!linkData) {
      return errorResponse('Link not found', 'NOT_FOUND', 404, request);
    }
    
    if (linkData.owner_id !== request.user.id) {
      return errorResponse('Access denied', 'FORBIDDEN', 403, request);
    }
    
    // Get status change history
    const history = await env.DB.prepare(`
      SELECT old_status, new_status, changed_at
      FROM link_status_changes
      WHERE slug = ?
      ORDER BY changed_at DESC
      LIMIT ?
    `).bind(slug, limit).all();
    
    return successResponse({
      slug,
      current_status: linkData.status,
      current_url: linkData.active_url,
      last_checked: linkData.last_checked,
      history: history.results.map(row => ({
        from_status: row.old_status,
        to_status: row.new_status,
        changed_at: row.changed_at
      }))
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting link health history:', error);
    return errorResponse('Failed to get link health history', 'HEALTH_HISTORY_FAILED', 500, request);
  }
}

/**
 * Trigger manual health check
 */
async function triggerManualHealthCheck(request, env, ctx) {
  try {
    const body = await request.json();
    const slugs = body.slugs || [];
    
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return errorResponse('Must provide array of slugs to check', 'INVALID_SLUGS', 400, request);
    }
    
    if (slugs.length > 10) {
      return errorResponse('Maximum 10 links per manual check', 'TOO_MANY_SLUGS', 400, request);
    }
    
    // Verify ownership of all links
    const verifiedSlugs = [];
    for (const slug of slugs) {
      const linkData = await env.LINKS.get(slug, 'json');
      if (linkData && linkData.owner_id === request.user.id) {
        verifiedSlugs.push(slug);
      }
    }
    
    if (verifiedSlugs.length === 0) {
      return errorResponse('No valid links found', 'NO_VALID_LINKS', 404, request);
    }
    
    // Import health check function
    const { checkLinkHealth } = await import('./health-check-test-utils.js');
    
    // Trigger health checks (don't wait for completion)
    verifiedSlugs.forEach(slug => {
      ctx.waitUntil(checkLinkHealth(slug, env, {
        timeout: 5000,
        maxRetries: 2
      }));
    });
    
    return successResponse({
      message: `Health check triggered for ${verifiedSlugs.length} links`,
      checked_slugs: verifiedSlugs
    }, 200, request);
    
  } catch (error) {
    console.error('Error triggering manual health check:', error);
    return errorResponse('Failed to trigger health check', 'HEALTH_CHECK_FAILED', 500, request);
  }
}

/**
 * Get system health status
 */
async function getSystemHealthStatus(request, env, ctx) {
  try {
    // Get latest health check run
    const lastRun = await env.DB.prepare(`
      SELECT run_at, links_checked, duration_ms
      FROM health_check_runs
      ORDER BY run_at DESC
      LIMIT 1
    `).first();
    
    // Get total system stats
    const systemStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_links,
        SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) as live_links,
        SUM(CASE WHEN status LIKE 'fallback%' THEN 1 ELSE 0 END) as fallback_links,
        SUM(CASE WHEN status = 'dead' THEN 1 ELSE 0 END) as dead_links
      FROM links
      WHERE status != 'deleted'
    `).first();
    
    // Calculate system health score
    const totalActive = (systemStats?.live_links || 0) + (systemStats?.fallback_links || 0);
    const totalLinks = systemStats?.total_links || 1;
    const healthScore = Math.round((totalActive / totalLinks) * 100);
    
    return successResponse({
      system: {
        health_score: healthScore,
        last_run_at: lastRun?.run_at,
        last_run_duration: lastRun?.duration_ms,
        last_run_links: lastRun?.links_checked
      },
      links: {
        total: systemStats?.total_links || 0,
        live: systemStats?.live_links || 0,
        fallback: systemStats?.fallback_links || 0,
        dead: systemStats?.dead_links || 0
      },
      status: healthScore >= 95 ? 'healthy' : healthScore >= 80 ? 'degraded' : 'unhealthy'
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting system health:', error);
    return errorResponse('Failed to get system health', 'SYSTEM_HEALTH_FAILED', 500, request);
  }
}

// ==================== PHASE 2 HANDLERS ====================

/**
 * Create a new link
 */
async function createLink(request, env, ctx) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationErrors = validateLinkInput(body);
    if (validationErrors.length > 0) {
      return errorResponse(validationErrors.join(', '), 'VALIDATION_ERROR', 400, request);
    }
    
    // Check user's link limit
    const withinLimit = await checkLinkLimit(env, request.user.id, request.user.plan);
    if (!withinLimit) {
      return errorResponse('Link limit reached for your plan', 'LIMIT_EXCEEDED', 403, request);
    }
    
    // Generate unique slug
    const slug = nanoid(7);
    const now = Date.now();
    
    // Prepare link data for KV storage (fast reads)
    const linkData = {
      slug,
      primary_url: body.url,
      fallback_urls: body.fallback_urls || [],
      active_url: body.url,
      status: 'live',
      owner_id: request.user.id,
      created_at: now,
      updated_at: now
    };
    
    // Store in KV for fast redirect lookups
    await env.LINKS.put(slug, JSON.stringify(linkData));
    
    // Store metadata in D1 for analytics and management
    await env.DB.prepare(`
      INSERT INTO links (slug, owner_id, created_at, updated_at, status) 
      VALUES (?, ?, ?, ?, ?)
    `).bind(slug, request.user.id, now, now, 'live').run();
    
    // Return created link
    return successResponse({
      slug,
      short_url: `https://${request.headers.get('host')}/r/${slug}`,
      target_url: body.url,
      fallback_urls: body.fallback_urls || [],
      status: 'live',
      created_at: now
    }, 201, request);
    
  } catch (error) {
    console.error('Error creating link:', error);
    return errorResponse('Failed to create link', 'CREATE_FAILED', 500, request);
  }
}

/**
 * Get link details
 */
async function getLink(request, env, ctx) {
  try {
    const { slug } = request.params;
    
    // Get from KV
    const linkData = await env.LINKS.get(slug, 'json');
    
    if (!linkData) {
      return errorResponse('Link not found', 'NOT_FOUND', 404, request);
    }
    
    // Verify ownership
    if (linkData.owner_id !== request.user.id) {
      return errorResponse('Access denied', 'FORBIDDEN', 403, request);
    }
    
    // Get analytics from D1
    const linkMetadata = await env.DB.prepare(`
      SELECT clicks, last_clicked, status FROM links WHERE slug = ?
    `).bind(slug).first();
    
    return successResponse({
      ...linkData,
      clicks: linkMetadata?.clicks || 0,
      last_clicked: linkMetadata?.last_clicked
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting link:', error);
    return errorResponse('Failed to retrieve link', 'GET_FAILED', 500, request);
  }
}

/**
 * List user's links
 */
async function listLinks(request, env, ctx) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;
    const status = searchParams.get('status'); // Optional filter
    
    // Build query with optional status filter
    let query = `
      SELECT slug, created_at, updated_at, clicks, last_clicked, status 
      FROM links 
      WHERE owner_id = ? AND status != 'deleted'
    `;
    const params = [request.user.id];
    
    if (status && ['live', 'paused', 'disabled'].includes(status)) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    // Get links from D1
    const { results } = await env.DB.prepare(query).bind(...params).all();
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM links WHERE owner_id = ? AND status != \'deleted\'';
    const countParams = [request.user.id];
    
    if (status && ['live', 'paused', 'disabled'].includes(status)) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    const { total } = await env.DB.prepare(countQuery).bind(...countParams).first();
    
    // Fetch full data from KV for each link
    const links = await Promise.all(
      results.map(async (row) => {
        const linkData = await env.LINKS.get(row.slug, 'json');
        return {
          ...linkData,
          clicks: row.clicks,
          last_clicked: row.last_clicked
        };
      })
    );
    
    return successResponse({
      links,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, 200, request);
    
  } catch (error) {
    console.error('Error listing links:', error);
    return errorResponse('Failed to list links', 'LIST_FAILED', 500, request);
  }
}

/**
 * Update a link
 */
async function updateLink(request, env, ctx) {
  try {
    const { slug } = request.params;
    const updates = await request.json();
    
    // Get existing link
    const linkData = await env.LINKS.get(slug, 'json');
    
    if (!linkData) {
      return errorResponse('Link not found', 'NOT_FOUND', 404, request);
    }
    
    if (linkData.owner_id !== request.user.id) {
      return errorResponse('Access denied', 'FORBIDDEN', 403, request);
    }
    
    // Validate updates
    if (updates.url || updates.primary_url) {
      const newUrl = updates.url || updates.primary_url;
      if (!isValidRedirectUrl(newUrl, env)) {
        return errorResponse('Invalid or unsafe URL provided', 'INVALID_URL', 400, request);
      }
      updates.primary_url = newUrl;
      updates.active_url = newUrl; // Reset to primary URL
      delete updates.url; // Remove deprecated field
    }
    
    if (updates.fallback_urls && !Array.isArray(updates.fallback_urls)) {
      return errorResponse('fallback_urls must be an array', 'INVALID_FALLBACK', 400, request);
    }
    
    if (updates.status && !['live', 'paused', 'disabled'].includes(updates.status)) {
      return errorResponse('Status must be live, paused, or disabled', 'INVALID_STATUS', 400, request);
    }
    
    // Update link data
    const updatedLink = {
      ...linkData,
      ...updates,
      updated_at: Date.now()
    };
    
    // Save to KV
    await env.LINKS.put(slug, JSON.stringify(updatedLink));
    
    // Update D1 metadata
    await env.DB.prepare(`
      UPDATE links SET updated_at = ?, status = ? WHERE slug = ?
    `).bind(updatedLink.updated_at, updatedLink.status, slug).run();
    
    return successResponse(updatedLink, 200, request);
    
  } catch (error) {
    console.error('Error updating link:', error);
    return errorResponse('Failed to update link', 'UPDATE_FAILED', 500, request);
  }
}

/**
 * Delete a link
 */
async function deleteLink(request, env, ctx) {
  try {
    const { slug } = request.params;
    
    // Verify ownership
    const linkData = await env.LINKS.get(slug, 'json');
    
    if (!linkData) {
      return errorResponse('Link not found', 'NOT_FOUND', 404, request);
    }
    
    if (linkData.owner_id !== request.user.id) {
      return errorResponse('Access denied', 'FORBIDDEN', 403, request);
    }
    
    // Delete from KV
    await env.LINKS.delete(slug);
    
    // Mark as deleted in D1 (preserve analytics)
    await env.DB.prepare(`
      UPDATE links SET status = 'deleted', updated_at = ? WHERE slug = ?
    `).bind(Date.now(), slug).run();
    
    return successResponse(null, 204, request);
    
  } catch (error) {
    console.error('Error deleting link:', error);
    return errorResponse('Failed to delete link', 'DELETE_FAILED', 500, request);
  }
}

/**
 * Get user profile
 */
async function getUserProfile(request, env, ctx) {
  try {
    const user = await env.DB.prepare(`
      SELECT id, email, plan, created_at, last_login, status 
      FROM users 
      WHERE id = ?
    `).bind(request.user.id).first();
    
    if (!user) {
      return errorResponse('User not found', 'USER_NOT_FOUND', 404, request);
    }
    
    return successResponse({
      id: user.id,
      email: user.email,
      plan: user.plan,
      created_at: user.created_at,
      last_login: user.last_login,
      status: user.status
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting user profile:', error);
    return errorResponse('Failed to get profile', 'PROFILE_FAILED', 500, request);
  }
}

/**
 * Get user statistics
 */
async function getUserStats(request, env, ctx) {
  try {
    // Get link counts by status
    const linkStats = await env.DB.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(clicks) as total_clicks
      FROM links 
      WHERE owner_id = ? 
      GROUP BY status
    `).bind(request.user.id).all();
    
    // Get recent clicks (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentClicks = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM clicks c
      JOIN links l ON c.slug = l.slug
      WHERE l.owner_id = ? AND c.clicked_at > ?
    `).bind(request.user.id, thirtyDaysAgo).first();
    
    // Format stats
    const stats = {
      links: {
        total: 0,
        live: 0,
        paused: 0,
        disabled: 0,
        deleted: 0
      },
      clicks: {
        total: 0,
        last_30_days: recentClicks?.count || 0
      }
    };
    
    linkStats.results.forEach(row => {
      stats.links[row.status] = row.count;
      stats.links.total += row.count;
      stats.clicks.total += row.total_clicks || 0;
    });
    
    return successResponse(stats, 200, request);
    
  } catch (error) {
    console.error('Error getting user stats:', error);
    return errorResponse('Failed to get statistics', 'STATS_FAILED', 500, request);
  }
}

// ==================== PHASE 4 ANALYTICS HANDLERS ====================

/**
 * Get analytics for a specific link
 */
async function getLinkAnalytics(request, env, ctx) {
  try {
    const { slug } = request.params;
    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30')));
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Verify link ownership
    const linkData = await env.LINKS.get(slug, 'json');
    if (!linkData) {
      return errorResponse('Link not found', 'NOT_FOUND', 404, request);
    }
    
    if (linkData.owner_id !== request.user.id) {
      return errorResponse('Access denied', 'FORBIDDEN', 403, request);
    }
    
    // Get detailed analytics
    const dailyStats = await env.DB.prepare(`
      SELECT 
        DATE(timestamp/1000, 'unixepoch') as date,
        COUNT(*) as total_clicks,
        COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(CASE WHEN is_bot = 1 THEN 1 END) as bot_clicks,
        COUNT(DISTINCT ip_hash) as unique_visitors,
        COUNT(DISTINCT country) as unique_countries
      FROM click_events 
      WHERE slug = ? AND timestamp >= ?
      GROUP BY date 
      ORDER BY date
    `).bind(slug, since).all();
    
    // Get geographic breakdown
    const geoBreakdown = await env.DB.prepare(`
      SELECT 
        country,
        COUNT(*) as total_clicks,
        COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(DISTINCT ip_hash) as unique_visitors
      FROM click_events 
      WHERE slug = ? AND timestamp >= ? AND country IS NOT NULL
      GROUP BY country 
      ORDER BY human_clicks DESC 
      LIMIT 10
    `).bind(slug, since).all();
    
    // Get referer breakdown
    const refererBreakdown = await env.DB.prepare(`
      SELECT 
        referer_domain,
        COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(*) as total_clicks
      FROM click_events 
      WHERE slug = ? AND timestamp >= ? 
        AND referer_domain IS NOT NULL AND referer_domain != ''
      GROUP BY referer_domain 
      ORDER BY human_clicks DESC 
      LIMIT 10
    `).bind(slug, since).all();
    
    // Calculate summary
    const summary = dailyStats.results.reduce((acc, day) => ({
      total_clicks: acc.total_clicks + day.total_clicks,
      human_clicks: acc.human_clicks + day.human_clicks,
      bot_clicks: acc.bot_clicks + day.bot_clicks,
      unique_visitors: acc.unique_visitors + day.unique_visitors
    }), { total_clicks: 0, human_clicks: 0, bot_clicks: 0, unique_visitors: 0 });
    
    return successResponse({
      slug,
      period: `${days} days`,
      summary,
      daily_stats: dailyStats.results,
      geographic_breakdown: geoBreakdown.results,
      referrer_breakdown: refererBreakdown.results,
      link_info: {
        status: linkData.status,
        created_at: linkData.created_at,
        primary_url: linkData.primary_url,
        active_url: linkData.active_url
      }
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting link analytics:', error);
    return errorResponse('Failed to get analytics', 'ANALYTICS_FAILED', 500, request);
  }
}

/**
 * Get user's overall analytics overview
 */
async function getAnalyticsOverview(request, env, ctx) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30')));
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Get user's links
    const userLinks = await env.DB.prepare(
      'SELECT slug FROM links WHERE owner_id = ? AND status != ?'
    ).bind(request.user.id, 'deleted').all();
    
    const slugs = userLinks.results.map(l => l.slug);
    
    if (slugs.length === 0) {
      return successResponse({
        period: `${days} days`,
        summary: { total_clicks: 0, human_clicks: 0, bot_clicks: 0, active_links: 0 },
        daily_trends: [],
        top_links: [],
        geographic_summary: [],
        bot_detection_summary: { human: 0, likely_bot: 0, definite_bot: 0 }
      }, 200, request);
    }
    
    // Aggregate analytics across all user links
    const placeholders = slugs.map(() => '?').join(',');
    
    // Daily trends
    const dailyTrends = await env.DB.prepare(`
      SELECT 
        DATE(timestamp/1000, 'unixepoch') as date,
        COUNT(*) as total_clicks,
        COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(CASE WHEN is_bot = 1 THEN 1 END) as bot_clicks,
        COUNT(DISTINCT ip_hash) as unique_visitors
      FROM click_events 
      WHERE slug IN (${placeholders}) AND timestamp >= ?
      GROUP BY date 
      ORDER BY date
    `).bind(...slugs, since).all();
    
    // Top performing links
    const topLinks = await env.DB.prepare(`
      SELECT 
        slug,
        COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(*) as total_clicks,
        COUNT(DISTINCT ip_hash) as unique_visitors
      FROM click_events 
      WHERE slug IN (${placeholders}) AND timestamp >= ?
      GROUP BY slug 
      ORDER BY human_clicks DESC 
      LIMIT 10
    `).bind(...slugs, since).all();
    
    // Geographic summary
    const geoSummary = await env.DB.prepare(`
      SELECT 
        country,
        COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(*) as total_clicks
      FROM click_events 
      WHERE slug IN (${placeholders}) AND timestamp >= ? AND country IS NOT NULL
      GROUP BY country 
      ORDER BY human_clicks DESC 
      LIMIT 15
    `).bind(...slugs, since).all();
    
    // Bot detection summary
    const botSummary = await env.DB.prepare(`
      SELECT 
        CASE 
          WHEN bot_score >= 90 THEN 'definite_bot'
          WHEN bot_score >= 50 THEN 'likely_bot'
          WHEN bot_score >= 25 THEN 'suspicious'
          ELSE 'human'
        END as category,
        COUNT(*) as count
      FROM click_events 
      WHERE slug IN (${placeholders}) AND timestamp >= ?
      GROUP BY category
    `).bind(...slugs, since).all();
    
    // Calculate summary
    const summary = {
      total_clicks: dailyTrends.results.reduce((sum, day) => sum + day.total_clicks, 0),
      human_clicks: dailyTrends.results.reduce((sum, day) => sum + day.human_clicks, 0),
      bot_clicks: dailyTrends.results.reduce((sum, day) => sum + day.bot_clicks, 0),
      active_links: slugs.length,
      unique_countries: [...new Set(geoSummary.results.map(g => g.country))].length
    };
    
    return successResponse({
      period: `${days} days`,
      summary,
      daily_trends: dailyTrends.results,
      top_links: topLinks.results,
      geographic_summary: geoSummary.results,
      bot_detection_summary: botSummary.results
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting analytics overview:', error);
    return errorResponse('Failed to get analytics overview', 'OVERVIEW_FAILED', 500, request);
  }
}

/**
 * Get real-time analytics (last 24 hours)
 */
async function getRealtimeAnalytics(request, env, ctx) {
  try {
    const since = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    // Get user's recent clicks
    const recentClicks = await env.DB.prepare(`
      SELECT 
        ce.slug,
        ce.timestamp,
        ce.is_bot,
        ce.bot_score,
        ce.country,
        ce.referer_domain,
        l.primary_url
      FROM click_events ce
      JOIN links l ON ce.slug = l.slug
      WHERE l.owner_id = ? AND ce.timestamp >= ?
      ORDER BY ce.timestamp DESC
      LIMIT 50
    `).bind(request.user.id, since).all();
    
    // Aggregate by hour
    const hourlyStats = {};
    recentClicks.results.forEach(click => {
      const hour = Math.floor(click.timestamp / 3600000) * 3600000; // Round to hour
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { human: 0, bot: 0, total: 0 };
      }
      hourlyStats[hour].total++;
      if (click.is_bot) {
        hourlyStats[hour].bot++;
      } else {
        hourlyStats[hour].human++;
      }
    });
    
    // Get current system activity
    const systemActivity = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_clicks,
        COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(CASE WHEN is_bot = 1 THEN 1 END) as bot_clicks
      FROM click_events 
      WHERE timestamp >= ?
    `).bind(since).first();
    
    return successResponse({
      timeframe: '24 hours',
      recent_clicks: recentClicks.results.slice(0, 20),
      hourly_breakdown: Object.entries(hourlyStats).map(([timestamp, counts]) => ({
        hour: new Date(parseInt(timestamp)).toISOString(),
        human_clicks: counts.human,
        bot_clicks: counts.bot,
        total_clicks: counts.total
      })).sort((a, b) => a.hour.localeCompare(b.hour)),
      system_activity: systemActivity
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting realtime analytics:', error);
    return errorResponse('Failed to get realtime analytics', 'REALTIME_FAILED', 500, request);
  }
}

/**
 * Export analytics data
 */
async function exportAnalytics(request, env, ctx) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30')));
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // FIXED: Phase 7 Critical Issue #2 - Add pagination to prevent memory exhaustion
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 1000, 10000); // Max 10k records
    const offset = (page - 1) * limit;

    // Get total count first
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM click_events ce
      JOIN links l ON ce.slug = l.slug
      WHERE l.owner_id = ? AND ce.timestamp >= ?
    `).bind(request.user.id, since).first();

    const totalRecords = countResult?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    // Get paginated data
    const data = await env.DB.prepare(`
      SELECT 
        ce.slug,
        ce.timestamp,
        ce.is_bot,
        ce.bot_score,
        ce.country,
        ce.city,
        ce.referer_domain,
        ce.timezone,
        l.primary_url,
        l.status as link_status
      FROM click_events ce
      JOIN links l ON ce.slug = l.slug
      WHERE l.owner_id = ? AND ce.timestamp >= ?
      ORDER BY ce.timestamp DESC
      LIMIT ? OFFSET ?
    `).bind(request.user.id, since, limit, offset).all();
    
    if (format === 'csv') {
      const csv = [
        'slug,timestamp,is_bot,bot_score,country,city,referer_domain,timezone,primary_url,link_status',
        ...data.results.map(row => 
          `${row.slug},${new Date(row.timestamp).toISOString()},${row.is_bot},${row.bot_score},${row.country || ''},${row.city || ''},${row.referer_domain || ''},${row.timezone || ''},${row.primary_url},${row.link_status}`
        )
      ].join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-${Date.now()}.csv"`
        }
      });
    }
    
    return successResponse({
      export_date: new Date().toISOString(),
      period: `${days} days`,
      pagination: {
        page,
        limit,
        total_records: totalRecords,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      },
      data: data.results
    }, 200, request);
    
  } catch (error) {
    console.error('Error exporting analytics:', error);
    return errorResponse('Failed to export analytics', 'EXPORT_FAILED', 500, request);
  }
}

/**
 * Get bot detection statistics
 */
async function getBotStats(request, env, ctx) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = Math.min(168, Math.max(1, parseInt(searchParams.get('hours') || '24'))); // Max 1 week
    const timeRange = hours * 60 * 60 * 1000;
    
    const stats = await getBotDetectionStats(env, timeRange);
    
    if (!stats) {
      return errorResponse('Failed to get bot statistics', 'BOT_STATS_FAILED', 500, request);
    }
    
    return successResponse({
      timeframe: `${hours} hours`,
      ...stats
    }, 200, request);
    
  } catch (error) {
    console.error('Error getting bot stats:', error);
    return errorResponse('Failed to get bot statistics', 'BOT_STATS_FAILED', 500, request);
  }
}