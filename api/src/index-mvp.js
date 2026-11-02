/**
 * Dead Link Switchboard API - MVP Version
 * Includes all essential features for launch
 */

import { Router } from 'itty-router';
import { addCorsHeaders, handleOptions } from './cors-simple.js';

// Auth imports
import { 
  handleSignUp, 
  handleSignIn, 
  handleOAuthSignIn, 
  handleGetSession, 
  handleGetUser, 
  handleSignOut 
} from './auth-endpoints-secure.js';
import { validateSession } from './lib/auth-utils.js';

// Core features imports
import { handleHealthCheck } from './health-monitor-system.js';
import { handleManualHealthCheck, scheduled as scheduledHealthCheck } from './scheduled-health-checks.js';
import { ErrorLogger, withErrorTracking } from './error-logger.js';
import { 
  handlePasswordResetRequest, 
  handlePasswordReset 
} from './password-reset.js';
import { 
  handleDataExport, 
  handleAccountDeletion 
} from './gdpr-compliance.js';
import {
  createLink,
  bulkCreateLinks,
  bulkDeleteLinks,
  updateLink,
  getLinkCategories
} from './link-operations.js';
import {
  getUserUsage,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  validateApiKey
} from './usage-notifications.js';
import { handleQRCodeRequest } from './qr-code.js';
import {
  registerWebhook,
  listWebhooks,
  deleteWebhook
} from './webhook-security.js';

// Create router
const router = Router();

// Middleware to require authentication
const requireAuth = async (request, env, next) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  // Check for API key
  if (token?.startsWith('dl_')) {
    const apiKeyData = await validateApiKey(token, env);
    if (apiKeyData) {
      request.userId = apiKeyData.userId;
      request.auth = { type: 'apikey', ...apiKeyData };
      return next();
    }
  }
  
  // Check for session token
  const session = await validateSession(token, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  request.userId = session.user_id;
  request.auth = { type: 'session', session };
  return next();
};

// Handle OPTIONS requests
router.options('*', (request) => handleOptions(request));

// Test endpoint for authentication debugging
router.get('/api/test/auth', requireAuth, async (request, env) => {
  return new Response(JSON.stringify({
    success: true,
    userId: request.userId,
    authType: request.auth?.type,
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Health check endpoints
router.get('/health', (request, env) => handleHealthCheck(request, env));
router.post('/api/admin/health-check', (request, env) => handleManualHealthCheck(request, env));

// Auth endpoints
router.post('/api/auth/signup', (request, env) => handleSignUp(request, env));
router.post('/api/auth/signin', (request, env) => handleSignIn(request, env));
router.post('/api/auth/oauth', (request, env) => handleOAuthSignIn(request, env));
router.get('/api/auth/session', (request, env) => handleGetSession(request, env));
router.get('/api/auth/user', (request, env) => handleGetUser(request, env));
router.post('/api/auth/signout', (request, env) => handleSignOut(request, env));

// Password reset
router.post('/api/auth/reset-password/request', (request, env) => handlePasswordResetRequest(request, env));
router.post('/api/auth/reset-password/complete', (request, env) => handlePasswordReset(request, env));

// GDPR compliance
router.get('/api/user/data-export', requireAuth, (request, env) => handleDataExport(request, env));
router.post('/api/user/delete-account', requireAuth, (request, env) => handleAccountDeletion(request, env));

// Usage and limits
router.get('/api/user/usage', requireAuth, async (request, env) => {
  const usage = await getUserUsage(request.userId, env);
  return new Response(JSON.stringify(usage), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// API key management
router.get('/api/keys', requireAuth, async (request, env) => {
  const keys = await listApiKeys(request.userId, env);
  return new Response(JSON.stringify({ keys }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.post('/api/keys', requireAuth, async (request, env) => {
  const { name, scopes, expiresIn } = await request.json();
  const key = await createApiKey(request.userId, name, scopes, expiresIn, env);
  return new Response(JSON.stringify(key), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
});

router.delete('/api/keys/:keyId', requireAuth, async (request, env) => {
  const result = await revokeApiKey(request.userId, request.params.keyId, env);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Link operations
router.post('/api/v1/links', requireAuth, async (request, env) => {
  const data = await request.json();
  const link = await createLink(data, request.userId, env, request);
  return new Response(JSON.stringify(link), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
});

router.post('/api/v1/links/bulk', requireAuth, async (request, env) => {
  const { links } = await request.json();
  const results = await bulkCreateLinks(links, request.userId, env, request);
  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

router.delete('/api/v1/links/bulk', requireAuth, async (request, env) => {
  const { slugs } = await request.json();
  const results = await bulkDeleteLinks(slugs, request.userId, env);
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.patch('/api/v1/links/:slug', requireAuth, async (request, env) => {
  const updates = await request.json();
  const result = await updateLink(request.params.slug, updates, request.userId, env);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.get('/api/v1/links/categories', requireAuth, async (request, env) => {
  const categories = await getLinkCategories(request.userId, env);
  return new Response(JSON.stringify({ categories }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Get user links with pagination
router.get('/api/v1/links', requireAuth, async (request, env) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;
  
  try {
    // Get links from database
    const linksResult = await env.DB.prepare(
      'SELECT * FROM links WHERE owner_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(request.userId, limit, offset).all();
    
    // Get total count
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM links WHERE owner_id = ?'
    ).bind(request.userId).first();
    
    // Transform links to match frontend interface
    const transformedLinks = linksResult.results.map(link => ({
      slug: link.slug,
      primary_url: link.url,
      active_url: getActiveUrl(link),
      fallback_urls: [link.fallback_1, link.fallback_2, link.fallback_3].filter(Boolean),
      status: link.status,
      created_at: link.created_at,
      updated_at: link.updated_at,
      clicks: link.clicks
    }));
    
    return new Response(JSON.stringify({
      links: transformedLinks,
      total: countResult.total
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Links fetch error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch links' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Helper function to determine active URL based on status
function getActiveUrl(link) {
  switch (link.status) {
    case 'fallback_1':
      return link.fallback_1 || link.url;
    case 'fallback_2':
      return link.fallback_2 || link.fallback_1 || link.url;
    case 'fallback_3':
      return link.fallback_3 || link.fallback_2 || link.fallback_1 || link.url;
    case 'dead':
    case 'paused':
      return null;
    default:
      return link.url;
  }
}

// Get specific link
router.get('/api/v1/links/:slug', requireAuth, async (request, env) => {
  try {
    const linkResult = await env.DB.prepare(
      'SELECT * FROM links WHERE slug = ? AND owner_id = ?'
    ).bind(request.params.slug, request.userId).first();
    
    if (!linkResult) {
      return new Response(JSON.stringify({ error: 'Link not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(linkResult), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch link' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Analytics endpoints
router.get('/api/v1/analytics/link/:slug', requireAuth, async (request, env) => {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');
  
  try {
    // Get link analytics from database
    const analytics = {
      slug: request.params.slug,
      summary: {
        total_clicks: 0,
        human_clicks: 0,
        bot_clicks: 0,
        unique_countries: 0
      },
      daily: [],
      geo_breakdown: []
    };
    
    return new Response(JSON.stringify(analytics), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch analytics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

router.get('/api/v1/analytics/overview', requireAuth, async (request, env) => {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');
  
  try {
    // Get total links count
    const totalLinksResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM links WHERE owner_id = ?'
    ).bind(request.userId).first();
    
    // Get total clicks count
    const totalClicksResult = await env.DB.prepare(
      'SELECT SUM(clicks) as total FROM links WHERE owner_id = ?'  
    ).bind(request.userId).first();
    
    // Get top links by clicks
    const topLinksResult = await env.DB.prepare(
      'SELECT slug, url, clicks FROM links WHERE owner_id = ? ORDER BY clicks DESC LIMIT 10'
    ).bind(request.userId).all();
    
    // Transform links to match frontend interface
    const transformedTopLinks = topLinksResult.results.map(link => ({
      slug: link.slug,
      primary_url: link.url,
      human_clicks: Math.floor(link.clicks * 0.8) // Estimate human vs bot clicks
    }));
    
    const totalClicks = totalClicksResult.total || 0;
    
    const analytics = {
      totalLinks: totalLinksResult.count,
      totalClicks: totalClicks,
      humanClicks: Math.floor(totalClicks * 0.8), // Estimate 80% human
      botClicks: Math.floor(totalClicks * 0.2),   // Estimate 20% bot
      uniqueCountries: 0, // TODO: Requires geo tracking implementation
      dailyTrends: [], // TODO: Requires daily analytics table
      topLinks: transformedTopLinks
    };
    
    return new Response(JSON.stringify(analytics), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch analytics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// QR codes
router.get('/api/v1/qr/:slug', (request, env) => handleQRCodeRequest(request, env));

// Webhooks
router.get('/api/webhooks', requireAuth, async (request, env) => {
  const webhooks = await listWebhooks(request.userId, env);
  return new Response(JSON.stringify({ webhooks }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.post('/api/webhooks', requireAuth, async (request, env) => {
  const { url, events } = await request.json();
  const webhook = await registerWebhook(request.userId, url, events, env);
  return new Response(JSON.stringify(webhook), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
});

router.delete('/api/webhooks/:webhookId', requireAuth, async (request, env) => {
  const result = await deleteWebhook(request.userId, request.params.webhookId, env);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Redirect handler
router.get('/r/:slug', async (request, env, ctx) => {
  const slug = request.params.slug;
  
  try {
    // Get link from KV
    const linkData = await env.LINKS.get(slug, 'json');
    
    if (!linkData) {
      return new Response('Link not found', { status: 404 });
    }
    
    // Check expiration
    if (linkData.expires_at && Date.now() > linkData.expires_at) {
      return new Response('Link has expired', { status: 410 });
    }
    
    // Log click
    if (linkData.owner_id) {
      ctx.waitUntil(
        env.DB.prepare(
          'UPDATE links SET clicks = clicks + 1, last_clicked = unixepoch() WHERE slug = ?'
        ).bind(slug).run()
      );
    }
    
    // Redirect based on status
    let redirectUrl = linkData.url;
    if (linkData.status === 'fallback_1' && linkData.fallback_1) {
      redirectUrl = linkData.fallback_1;
    } else if (linkData.status === 'fallback_2' && linkData.fallback_2) {
      redirectUrl = linkData.fallback_2;
    } else if (linkData.status === 'fallback_3' && linkData.fallback_3) {
      redirectUrl = linkData.fallback_3;
    } else if (linkData.status === 'dead') {
      return new Response('This link is no longer available', { status: 410 });
    }
    
    return Response.redirect(redirectUrl, 302);
    
  } catch (error) {
    console.error('Redirect error:', error);
    return new Response('Error processing redirect', { status: 500 });
  }
});

// 404 handler
router.all('*', () => 
  new Response('Not Found', { status: 404 })
);

// Export worker
export default {
  fetch: withErrorTracking(async (request, env, ctx) => {
    const response = await router.handle(request, env, ctx);
    return addCorsHeaders(response, request);
  }),
  
  // Scheduled handler for periodic health checks
  async scheduled(event, env, ctx) {
    return scheduledHealthCheck(event, env, ctx);
  }
};