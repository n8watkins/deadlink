// Authentication and User Management
// Phase 2: Links API

import { nanoid } from 'nanoid';

/**
 * Generate a secure API key
 */
export function generateApiKey() {
  return `dl_${nanoid(48)}`;
}

/**
 * Generate a secure user ID
 */
export function generateUserId() {
  return `user_${nanoid(16)}`;
}

/**
 * Create a new user in the database
 */
export async function createUser(env, email, plan = 'free') {
  const userId = generateUserId();
  const apiKey = generateApiKey();
  const now = Date.now();
  
  try {
    await env.DB.prepare(`
      INSERT INTO users (id, email, api_key, plan, created_at, updated_at, status) 
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).bind(userId, email, apiKey, plan, now, now).run();
    
    return { userId, email, apiKey, plan, created_at: now };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: users.email')) {
      throw new Error('User with this email already exists');
    }
    throw error;
  }
}

/**
 * Validate API key and return user information
 */
export async function validateApiKey(env, apiKey) {
  if (!apiKey || !apiKey.startsWith('dl_')) {
    return null;
  }
  
  try {
    const user = await env.DB.prepare(`
      SELECT id, email, plan, status, last_login 
      FROM users 
      WHERE api_key = ? AND status = 'active'
    `).bind(apiKey).first();
    
    if (user) {
      // Update last login timestamp
      await env.DB.prepare(`
        UPDATE users SET last_login = ? WHERE id = ?
      `).bind(Date.now(), user.id).run();
    }
    
    return user;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
}

/**
 * Get user plan limits
 */
export async function getUserLimits(env, plan) {
  try {
    const limits = await env.DB.prepare(`
      SELECT * FROM plan_limits WHERE plan = ?
    `).bind(plan).first();
    
    return limits || {
      links_limit: 100,
      clicks_per_month: 10000,
      api_requests_per_minute: 60,
      analytics_retention_days: 30,
      fallback_urls_limit: 3
    };
  } catch (error) {
    console.error('Error getting user limits:', error);
    // Return free tier limits as fallback
    return {
      links_limit: 100,
      clicks_per_month: 10000,
      api_requests_per_minute: 60,
      analytics_retention_days: 30,
      fallback_urls_limit: 3
    };
  }
}

/**
 * Check if user has reached their link limit
 */
export async function checkLinkLimit(env, userId, plan) {
  const limits = await getUserLimits(env, plan);
  
  if (limits.links_limit === -1) {
    return true; // Unlimited
  }
  
  const linkCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM links WHERE owner_id = ? AND status != 'deleted'
  `).bind(userId).first();
  
  return (linkCount?.count || 0) < limits.links_limit;
}

/**
 * Rate limiting for API requests
 */
export async function checkRateLimit(env, userId, plan) {
  const limits = await getUserLimits(env, plan);
  const window = Math.floor(Date.now() / 60000); // 1 minute window
  const key = `rate:${userId}:${window}`;
  
  try {
    // Get current count from KV
    const current = parseInt(await env.LINKS.get(key) || '0');
    
    if (current >= limits.api_requests_per_minute) {
      return {
        allowed: false,
        limit: limits.api_requests_per_minute,
        remaining: 0,
        resetTime: (window + 1) * 60000
      };
    }
    
    // Increment counter
    await env.LINKS.put(key, (current + 1).toString(), { 
      expirationTtl: 120 // 2 minute TTL
    });
    
    return {
      allowed: true,
      limit: limits.api_requests_per_minute,
      remaining: limits.api_requests_per_minute - current - 1,
      resetTime: (window + 1) * 60000
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Allow request if rate limiting fails
    return {
      allowed: true,
      limit: limits.api_requests_per_minute,
      remaining: limits.api_requests_per_minute - 1,
      resetTime: (window + 1) * 60000
    };
  }
}