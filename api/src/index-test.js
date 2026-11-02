// Test-specific worker without itty-router
// Implements the same functionality as index.js but compatible with test environment

import { nanoid } from 'nanoid';
import { withCORS, withAuth, withRateLimit, withRequestSizeLimit, validateLinkInput, errorResponse, successResponse } from './middleware.js';
import { checkLinkLimit } from './auth.js';
import { isValidRedirectUrl } from './security.js';

// Manual router for testing
class TestRouter {
  constructor() {
    this.routes = [];
    this.middleware = [];
  }
  
  all(pattern, handler) {
    this.middleware.push({ pattern, handler });
  }
  
  get(pattern, ...handlers) {
    this.routes.push({ method: 'GET', pattern, handlers });
  }
  
  post(pattern, ...handlers) {
    this.routes.push({ method: 'POST', pattern, handlers });
  }
  
  put(pattern, ...handlers) {
    this.routes.push({ method: 'PUT', pattern, handlers });
  }
  
  delete(pattern, ...handlers) {
    this.routes.push({ method: 'DELETE', pattern, handlers });
  }
  
  async handle(request, env, ctx) {
    const url = new URL(request.url);
    
    // Apply global middleware first
    for (const mw of this.middleware) {
      if (mw.pattern === '*') {
        const result = await mw.handler(request, env, ctx);
        if (result instanceof Response) {
          return result;
        }
      }
    }
    
    // Find matching route
    for (const route of this.routes) {
      if (route.method === request.method) {
        const match = this.matchRoute(route.pattern, url.pathname);
        if (match) {
          // Add params to request
          request.params = match.params;
          
          // Execute all handlers in sequence
          for (const handler of route.handlers) {
            const result = await handler(request, env, ctx);
            if (result instanceof Response) {
              return result;
            }
          }
        }
      }
    }
    
    // Debug: log unmatched routes
    console.log(`No route matched: ${request.method} ${url.pathname}`);
    console.log('Available routes:', this.routes.map(r => `${r.method} ${r.pattern}`));
    
    return errorResponse('Not Found', 'NOT_FOUND', 404, request);
  }
  
  matchRoute(pattern, pathname) {
    // Remove trailing slash for consistent matching
    const cleanPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
    const cleanPathname = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    
    // Simple pattern matching for our routes
    if (cleanPattern === cleanPathname) {
      return { params: {} };
    }
    
    // Handle parameterized routes like /api/v1/links/:slug
    const patternParts = cleanPattern.split('/').filter(Boolean);
    const pathParts = cleanPathname.split('/').filter(Boolean);
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      if (patternPart.startsWith(':')) {
        // Parameter
        params[patternPart.slice(1)] = pathPart;
      } else if (patternPart !== pathPart) {
        // Literal mismatch
        return null;
      }
    }
    
    return { params };
  }
}

// Create router instance
const router = new TestRouter();

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
        'content-type': 'text/plain',
        'Retry-After': '60'
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
    
    // Record click in analytics (async, don't wait)
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(recordClick(env, slug, request, linkData.active_url));
    } else {
      // In test environment, just run it without waiting
      recordClick(env, slug, request, linkData.active_url).catch(console.error);
    }
    
    // Log successful redirect (sanitized in production)
    if (env.ENVIRONMENT === 'development') {
      console.log(`Redirecting ${slug} to ${linkData.active_url} (KV: ${kvTime}ms)`);
    } else {
      console.log(`Redirect processed: ${slug} (KV: ${kvTime}ms)`);
    }
    
    // Perform redirect with cache headers
    return new Response(null, {
      status: 302,
      headers: {
        'Location': linkData.active_url,
        'Cache-Control': 'public, max-age=3600',
        'x-response-time': `${Date.now() - startTime}ms`,
        'x-kv-time': `${kvTime}ms`
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

// Record click analytics
async function recordClick(env, slug, request, redirectUrl) {
  try {
    if (!env.DB) return; // Skip if D1 not available
    
    const clickData = {
      slug,
      clicked_at: Date.now(),
      ip_hash: await hashIP(request.headers.get('CF-Connecting-IP') || 'unknown', env),
      country: request.cf?.country || null,
      user_agent: sanitizeHeader(request.headers.get('User-Agent')),
      referrer: sanitizeHeader(request.headers.get('Referer')),
      success: true,
      redirect_url: redirectUrl
    };
    
    // Insert click record
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
    
    // Update link click count
    await env.DB.prepare(`
      UPDATE links SET clicks = clicks + 1, last_clicked = ? WHERE slug = ?
    `).bind(clickData.clicked_at, slug).run();
    
  } catch (error) {
    console.error('Error recording click:', error);
  }
}

// Hash IP for privacy using crypto.subtle
async function hashIP(ip, env) {
  try {
    // Use environment salt for additional security
    const salt = env.IP_HASH_SALT || 'default_salt_change_in_production';
    const encoder = new TextEncoder();
    const data = encoder.encode(ip + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('').substring(0, 16); // Use first 16 chars for storage efficiency
  } catch (error) {
    // Fallback to simple hash if crypto.subtle is not available (test environment)
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      const char = ip.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}

// Sanitize header values to prevent injection attacks
function sanitizeHeader(header, maxLength = 255) {
  if (!header) return null;
  // Remove potentially dangerous characters and control chars
  const sanitized = header.replace(/[<>\"'&\x00-\x1f\x7f-\x9f]/g, '');
  return sanitized.substring(0, maxLength);
}

// ==================== PHASE 2 HANDLERS ====================

/**
 * Create a new link
 */
async function createLink(request, env, ctx) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return errorResponse('Invalid JSON in request body', 'INVALID_JSON', 400, request);
    }
    
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