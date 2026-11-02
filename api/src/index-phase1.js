// Security: Get appropriate CORS headers based on environment
function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  
  // In development, allow localhost
  if (env.ENVIRONMENT === 'development') {
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return { 'Access-Control-Allow-Origin': origin };
    }
  }
  
  // Check allowed origins from environment
  if (env.ALLOWED_ORIGINS) {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    if (allowedOrigins.includes(origin)) {
      return { 'Access-Control-Allow-Origin': origin };
    }
  }
  
  // Default: no CORS for unauthorized origins
  return {};
}

// Security: Standard security headers
function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block'
  };
}

// Simple rate limiting using in-memory storage (for demo)
// In production, use KV or Durable Objects for distributed rate limiting
const rateLimitMap = new Map();

function checkRateLimit(clientIP, env) {
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

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const url = new URL(request.url);
    
    // Basic rate limiting (only for redirect routes to avoid blocking health checks)
    if (url.pathname.startsWith('/r/')) {
      const clientIP = request.headers.get('CF-Connecting-IP') || 
                      request.headers.get('X-Forwarded-For') || 
                      'unknown';
      
      if (!checkRateLimit(clientIP, env)) {
        return new Response('Rate Limit Exceeded', { 
          status: 429,
          headers: { 
            'content-type': 'text/plain',
            'Retry-After': '60',
            ...getSecurityHeaders()
          }
        });
      }
    }
    
    // Handle redirect routes
    if (url.pathname.startsWith('/r/')) {
      return handleRedirect(request, env, startTime);
    }
    
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        message: 'Dead-Link Switchboard API',
        version: '1.0.0',
        environment: env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          redirect: '/r/:slug'
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request, env),
          ...getSecurityHeaders()
        }
      });
    }
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        worker: 'dead-link-switchboard',
        environment: env.ENVIRONMENT || 'development'
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request, env),
          ...getSecurityHeaders()
        }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

// Security: URL validation to prevent open redirect attacks
function isValidRedirectUrl(url, env) {
  try {
    const parsedUrl = new URL(url);
    
    // Only allow HTTPS URLs (security requirement)
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }
    
    // Block localhost and private IP ranges to prevent SSRF
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.2') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.')) {
      return false;
    }
    
    // Check against allowed domains if configured
    if (env.ALLOWED_DOMAINS) {
      const allowedDomains = env.ALLOWED_DOMAINS.split(',').map(d => d.trim().toLowerCase());
      if (!allowedDomains.includes(hostname) && !allowedDomains.includes('*')) {
        return false;
      }
    }
    
    // Block suspicious patterns
    if (url.includes('javascript:') || 
        url.includes('data:') || 
        url.includes('vbscript:') ||
        url.includes('<script') ||
        url.includes('</script>')) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

// Security: Slug validation to prevent injection attacks
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

async function handleRedirect(request, env, startTime) {
  const url = new URL(request.url);
  
  // Extract slug from path: /r/abc123 -> abc123
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Validate route structure
  if (pathParts[0] !== 'r' || !pathParts[1]) {
    console.log(`Invalid redirect route: ${url.pathname}`);
    return new Response('Not Found', { 
      status: 404,
      headers: { 
        'content-type': 'text/plain',
        'x-response-time': `${Date.now() - startTime}ms`
      }
    });
  }
  
  // Check for empty slug after r/
  if (pathParts[1].length === 0) {
    console.log(`Empty slug in route: ${url.pathname}`);
    return new Response('Not Found', { 
      status: 404,
      headers: { 
        'content-type': 'text/plain',
        'x-response-time': `${Date.now() - startTime}ms`
      }
    });
  }
  
  const slug = pathParts[1];
  
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