// API Middleware
// Phase 2: Links API

import { validateApiKey, checkRateLimit } from './auth.js';
import { isValidRedirectUrl } from './security.js';

/**
 * CORS middleware with proper origin validation
 */
export function withCORS(request, env, ctx) {
  const origin = request.headers.get('Origin');
  let corsHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  // Environment-specific origin handling for security
  if (env.ENVIRONMENT === 'development') {
    // In development, allow localhost origins specifically
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    }
  } else {
    // Production: validate against allowed origins list
    if (env.ALLOWED_ORIGINS) {
      const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
      if (allowedOrigins.includes(origin)) {
        corsHeaders['Access-Control-Allow-Origin'] = origin;
        corsHeaders['Access-Control-Allow-Credentials'] = 'true';
      }
    }
  }
  
  // If no specific origin is allowed, don't set CORS origin header for security
  // This prevents unauthorized cross-origin requests with credentials
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }
  
  // Store CORS headers for later use
  request.corsHeaders = corsHeaders;
  
  // Return undefined to continue to next handler
  return undefined;
}

/**
 * Request size limit middleware for security
 */
export function withRequestSizeLimit(request, env, ctx) {
  const contentLength = request.headers.get('content-length');
  const maxSize = parseInt(env.MAX_REQUEST_SIZE || '1048576'); // 1MB default
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    return new Response(JSON.stringify({
      error: 'Request Too Large',
      message: `Request size exceeds maximum allowed size of ${Math.floor(maxSize / 1024)}KB`,
      code: 'REQUEST_TOO_LARGE'
    }), { 
      status: 413,
      headers: { 
        'Content-Type': 'application/json',
        ...(request.corsHeaders || {})
      }
    });
  }
  
  // Return undefined to continue to next handler
  return undefined;
}

/**
 * Authentication middleware
 */
export async function withAuth(request, env, ctx) {
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'Missing API Key',
      message: 'API key must be provided in X-API-Key header or Authorization header',
      code: 'MISSING_API_KEY'
    }), { 
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        ...(request.corsHeaders || {})
      }
    });
  }
  
  const user = await validateApiKey(env, apiKey);
  
  if (!user) {
    return new Response(JSON.stringify({
      error: 'Invalid API Key',
      message: 'The provided API key is invalid or expired',
      code: 'INVALID_API_KEY'
    }), { 
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        ...(request.corsHeaders || {})
      }
    });
  }
  
  // Attach user to request for use in handlers
  request.user = user;
  
  // Return undefined to continue to next handler
  return undefined;
}

/**
 * Rate limiting middleware
 */
export async function withRateLimit(request, env, ctx) {
  if (!request.user) {
    return new Response('Internal Server Error', { status: 500 });
  }
  
  const rateLimit = await checkRateLimit(env, request.user.id, request.user.plan);
  
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Rate Limit Exceeded',
      message: `You have exceeded your rate limit of ${rateLimit.limit} requests per minute`,
      code: 'RATE_LIMIT_EXCEEDED',
      limit: rateLimit.limit,
      resetTime: rateLimit.resetTime
    }), { 
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': rateLimit.limit.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        'Retry-After': '60',
        ...(request.corsHeaders || {})
      }
    });
  }
  
  // Store rate limit info for response headers
  request.rateLimitHeaders = {
    'X-RateLimit-Limit': rateLimit.limit.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': rateLimit.resetTime.toString()
  };
  
  // Return undefined to continue to next handler
  return undefined;
}

/**
 * Input validation for link creation/updates
 */
export function validateLinkInput(data) {
  const errors = [];
  
  // Validate primary URL
  if (!data.url) {
    errors.push('URL is required');
  } else {
    if (!isValidRedirectUrl(data.url, {})) {
      errors.push('Invalid or unsafe URL provided');
    }
  }
  
  // Validate fallback URLs
  if (data.fallback_urls) {
    if (!Array.isArray(data.fallback_urls)) {
      errors.push('fallback_urls must be an array');
    } else {
      data.fallback_urls.forEach((url, index) => {
        if (!isValidRedirectUrl(url, {})) {
          errors.push(`Invalid fallback URL at index ${index}`);
        }
      });
    }
  }
  
  // Validate status
  if (data.status && !['live', 'paused', 'disabled'].includes(data.status)) {
    errors.push('Status must be one of: live, paused, disabled');
  }
  
  return errors;
}

/**
 * Security headers middleware
 */
export function addSecurityHeaders(response, request) {
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block'
  };
  
  // Add security headers to response
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Add CORS headers if available
  if (request.corsHeaders) {
    Object.entries(request.corsHeaders).forEach(([key, value]) => {
      if (value) { // Only set headers with actual values
        response.headers.set(key, value);
      }
    });
  }
  
  // Add rate limit headers if available
  if (request.rateLimitHeaders) {
    Object.entries(request.rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  
  return response;
}

/**
 * Error response helper
 */
export function errorResponse(message, code, status = 400, request = null) {
  const response = new Response(JSON.stringify({
    error: message,
    code,
    status
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(request?.corsHeaders || {}),
      ...(request?.rateLimitHeaders || {})
    }
  });
  
  return addSecurityHeaders(response, request || {});
}

/**
 * Success response helper
 */
export function successResponse(data, status = 200, request = null) {
  const response = new Response(
    data ? JSON.stringify(data) : null,
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...(request?.corsHeaders || {}),
        ...(request?.rateLimitHeaders || {})
      }
    }
  );
  
  return addSecurityHeaders(response, request || {});
}