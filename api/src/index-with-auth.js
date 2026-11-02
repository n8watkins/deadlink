import { Router } from 'itty-router';
import { nanoid } from 'nanoid';
import { addCorsHeaders, handleOptions } from './cors-simple.js';
import { 
  handleSignUp, 
  handleSignIn, 
  handleGetSession, 
  handleGetUser, 
  handleSignOut 
} from './auth-endpoints-secure.js';
import { validateSession } from './lib/auth-utils.js';
import { handleHealthCheck } from './health-monitor-system.js';
import { handleManualHealthCheck, scheduled } from './scheduled-health-checks.js';
import { ErrorLogger, withErrorTracking, AppError, ErrorCategory } from './error-logger.js';

// Create router
const router = Router();

// Handle OPTIONS requests
router.options('*', (request) => handleOptions(request));

// Health check endpoints
router.get('/health', (request, env) => handleHealthCheck(request, env));
router.post('/api/admin/health-check', (request, env) => handleManualHealthCheck(request, env));

// Auth endpoints
router.post('/api/auth/signup', (request, env) => handleSignUp(request, env));
router.post('/api/auth/signin', (request, env) => handleSignIn(request, env));
router.get('/api/auth/session', (request, env) => handleGetSession(request, env));
router.get('/api/auth/user', (request, env) => handleGetUser(request, env));
router.post('/api/auth/signout', (request, env) => handleSignOut(request, env));

// Links API (simplified for now)
router.post('/api/v1/links', async (request, env, ctx) => {
  const logger = new ErrorLogger(env);
  try {
    const data = await request.json();
    const slug = nanoid(6);
    
    // Get user from session
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    let userId = null;
    
    if (token) {
      const session = await validateSession(token, env);
      userId = session?.user_id;
    }
    
    // Store in KV
    await env.LINKS.put(slug, JSON.stringify({
      url: data.url,
      active_url: data.url,
      fallback_urls: data.fallback_urls || [],
      owner_id: userId,
      created_at: Date.now(),
      status: 'live'
    }));
    
    // Store in D1 if user is authenticated
    if (userId) {
      await env.DB.prepare(`
        INSERT INTO links (slug, primary_url, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, unixepoch(), unixepoch())
      `).bind(slug, data.url, userId).run();
    }
    
    return new Response(JSON.stringify({
      success: true,
      slug: slug,
      short_url: `${new URL(request.url).origin}/r/${slug}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Get user's links
router.get('/api/v1/links', async (request, env) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return new Response(JSON.stringify({ 
      error: 'Authentication required' 
    }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get user from session
    const session = await env.DB.prepare(
      'SELECT user_id FROM sessions WHERE token = ? AND expires_at > unixepoch()'
    ).bind(token).first();
    
    if (!session) {
      return new Response(JSON.stringify({ 
        error: 'Invalid session' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get user's links
    const links = await env.DB.prepare(`
      SELECT slug, primary_url, clicks, status, created_at
      FROM links
      WHERE owner_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(session.user_id).all();
    
    return new Response(JSON.stringify({
      links: links.results || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
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
    
    // Log click (simplified)
    if (linkData.owner_id) {
      ctx.waitUntil(
        env.DB.prepare(
          'UPDATE links SET clicks = clicks + 1 WHERE slug = ?'
        ).bind(slug).run()
      );
    }
    
    // Redirect
    return Response.redirect(linkData.active_url || linkData.url, 302);
    
  } catch (error) {
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
    return scheduled(event, env, ctx);
  }
};