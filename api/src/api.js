// Dead Link Switchboard API
// Phase 2: Links API with Authentication

import { Router } from 'itty-router';
import { nanoid } from 'nanoid';
import { withCORS, withAuth, withRateLimit, validateLinkInput, errorResponse, successResponse } from './middleware.js';
import { checkLinkLimit } from './auth.js';
import { isValidRedirectUrl } from './security.js';
import { getConfig, getShortUrl } from './config.js';

// Create router instance
const router = Router();

// Apply CORS to all routes
router.all('*', withCORS);

// Health check endpoint (no auth required)
router.get('/health', () => {
  return successResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'dead-link-switchboard-api',
    version: '2.0.0'
  });
});

// API information endpoint (no auth required) 
router.get('/', () => {
  return successResponse({
    message: 'Dead-Link Switchboard API',
    version: '2.0.0',
    documentation: getConfig(env).docsUrl + '/api',
    endpoints: {
      health: '/health',
      links: '/api/v1/links',
      redirect: '/r/:slug'
    }
  });
});

// Protected API routes
router.post('/api/v1/links', withAuth, withRateLimit, createLink);
router.get('/api/v1/links/:slug', withAuth, withRateLimit, getLink);
router.get('/api/v1/links', withAuth, withRateLimit, listLinks);
router.put('/api/v1/links/:slug', withAuth, withRateLimit, updateLink);
router.delete('/api/v1/links/:slug', withAuth, withRateLimit, deleteLink);

// User endpoints
router.get('/api/v1/user/profile', withAuth, withRateLimit, getUserProfile);
router.get('/api/v1/user/stats', withAuth, withRateLimit, getUserStats);

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

// Handler implementations

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
      short_url: getShortUrl(slug, getConfig(env, request)),
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
      WHERE owner_id = ?
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
    let countQuery = 'SELECT COUNT(*) as total FROM links WHERE owner_id = ?';
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