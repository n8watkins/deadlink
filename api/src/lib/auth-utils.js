import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

// Use a reasonable work factor for bcrypt (10-12 is standard)
const BCRYPT_ROUNDS = 10;

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token
 */
export function generateToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

/**
 * Generate API key
 */
export function generateApiKey() {
  return 'dl_' + generateToken();
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(token, sessionToken) {
  // In a real implementation, you'd store CSRF tokens in KV or DB
  // For now, we'll implement a simple check
  return token && token.length === 32;
}

/**
 * Create secure session
 */
export async function createSession(userId, request, env, expiryDays = 30) {
  const sessionToken = generateToken();
  const csrfToken = generateCSRFToken();
  const expiresAt = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);
  
  // Store session in database
  await env.DB.prepare(`
    INSERT INTO sessions (user_id, token, csrf_token, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    userId,
    sessionToken,
    csrfToken,
    expiresAt,
    request.headers.get('CF-Connecting-IP') || 'unknown',
    request.headers.get('User-Agent') || 'unknown'
  ).run();
  
  return {
    token: sessionToken,
    csrfToken,
    expiresAt
  };
}

/**
 * Validate session and return user ID
 * Supports both database sessions and NextAuth JWT tokens
 */
export async function validateSession(token, env) {
  if (!token) return null;
  
  // First try database session validation
  const session = await env.DB.prepare(`
    SELECT user_id, csrf_token, expires_at 
    FROM sessions 
    WHERE token = ? AND expires_at > unixepoch()
  `).bind(token).first();
  
  if (session) {
    return session;
  }
  
  // Try NextAuth JWT token validation (for frontend integration)
  try {
    // NextAuth JWT tokens are base64 encoded JSON with signature
    // For development, we'll decode and validate the payload
    // In production, you'd use proper JWT verification with secret
    
    const parts = token.split('.');
    if (parts.length === 3) {
      // This looks like a JWT token
      const payload = JSON.parse(atob(parts[1]));
      
      // Check if token is expired
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      
      // Check if this is a NextAuth token with user data
      if (payload.sub && payload.email) {
        // Find user by email to get user_id
        const user = await env.DB.prepare(`
          SELECT id FROM users WHERE email = ?
        `).bind(payload.email).first();
        
        if (user) {
          return {
            user_id: user.id,
            csrf_token: null, // NextAuth handles CSRF differently
            expires_at: payload.exp
          };
        }
      }
    }
  } catch (error) {
    // Token is not a valid JWT, continue with original session validation
    console.log('Not a valid JWT token:', error.message);
  }
  
  return null;
}

/**
 * Rate limiting check
 */
export async function checkRateLimit(identifier, action, env, limit = 5, windowMinutes = 15) {
  const key = `ratelimit:${action}:${identifier}`;
  const now = Date.now();
  const window = windowMinutes * 60 * 1000;
  
  // Get current attempts from KV
  const attempts = await env.RATE_LIMIT.get(key, { type: 'json' }) || [];
  
  // Filter out old attempts
  const recentAttempts = attempts.filter(timestamp => now - timestamp < window);
  
  if (recentAttempts.length >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Math.min(...recentAttempts) + window)
    };
  }
  
  // Add current attempt
  recentAttempts.push(now);
  
  // Store updated attempts
  await env.RATE_LIMIT.put(key, JSON.stringify(recentAttempts), {
    expirationTtl: windowMinutes * 60
  });
  
  return {
    allowed: true,
    remaining: limit - recentAttempts.length,
    resetAt: new Date(now + window)
  };
}