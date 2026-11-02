/**
 * Usage Notifications and API Key Management
 * Monitor usage and alert users approaching limits
 */

import { nanoid } from 'nanoid';
import { generateApiKey } from './lib/auth-utils.js';
import { AppError, ErrorCategory } from './error-logger.js';

/**
 * Get user's current usage
 */
export async function getUserUsage(userId, env) {
  // Get plan limits
  const user = await env.DB.prepare(`
    SELECT plan FROM users WHERE id = ?
  `).bind(userId).first();
  
  const planLimits = await env.DB.prepare(`
    SELECT * FROM plan_limits WHERE plan = ?
  `).bind(user.plan).first();
  
  // Get current usage
  const linkCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM links WHERE owner_id = ?
  `).bind(userId).first();
  
  // Get monthly clicks
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartTimestamp = Math.floor(monthStart.getTime() / 1000);
  
  const monthlyClicks = await env.DB.prepare(`
    SELECT COUNT(*) as count 
    FROM clicks c
    JOIN links l ON c.slug = l.slug
    WHERE l.owner_id = ? AND c.clicked_at > ?
  `).bind(userId, monthStartTimestamp).first();
  
  // Calculate usage percentages
  const usage = {
    links: {
      used: linkCount.count,
      limit: planLimits.links_limit,
      percentage: (linkCount.count / planLimits.links_limit) * 100,
      remaining: planLimits.links_limit - linkCount.count
    },
    clicks: {
      used: monthlyClicks.count,
      limit: planLimits.clicks_per_month,
      percentage: (monthlyClicks.count / planLimits.clicks_per_month) * 100,
      remaining: planLimits.clicks_per_month - monthlyClicks.count
    },
    plan: user.plan,
    planLimits
  };
  
  return usage;
}

/**
 * Check if user should receive usage warning
 */
export async function checkUsageWarnings(userId, env) {
  const usage = await getUserUsage(userId, env);
  const warnings = [];
  
  // Check link usage
  if (usage.links.percentage >= 90) {
    warnings.push({
      type: 'links',
      severity: usage.links.percentage >= 95 ? 'critical' : 'warning',
      message: `You've used ${usage.links.percentage.toFixed(1)}% of your link limit`,
      remaining: usage.links.remaining
    });
  }
  
  // Check click usage
  if (usage.clicks.percentage >= 80) {
    warnings.push({
      type: 'clicks',
      severity: usage.clicks.percentage >= 95 ? 'critical' : 'warning',
      message: `You've used ${usage.clicks.percentage.toFixed(1)}% of your monthly clicks`,
      remaining: usage.clicks.remaining
    });
  }
  
  return warnings;
}

/**
 * Send usage notification (would integrate with email service)
 */
export async function sendUsageNotification(userId, warnings, env) {
  // Get user email
  const user = await env.DB.prepare(`
    SELECT email, name FROM users WHERE id = ?
  `).bind(userId).first();
  
  // Log notification
  await env.DB.prepare(`
    INSERT INTO usage_notifications (
      user_id, notification_type, warnings, sent_at
    ) VALUES (?, ?, ?, unixepoch())
  `).bind(
    userId,
    'usage_warning',
    JSON.stringify(warnings)
  ).run();
  
  // In production, send actual email
  console.log(`Usage warning for ${user.email}:`, warnings);
  
  return { sent: true };
}

/**
 * API Key Management
 */

/**
 * List user's API keys
 */
export async function listApiKeys(userId, env) {
  const keys = await env.DB.prepare(`
    SELECT 
      id,
      name,
      key_prefix,
      scopes,
      last_used_at,
      created_at,
      expires_at,
      is_active
    FROM api_keys
    WHERE user_id = ? AND is_active = 1
    ORDER BY created_at DESC
  `).bind(userId).all();
  
  return keys.results || [];
}

/**
 * Create new API key
 */
export async function createApiKey(userId, name, scopes, expiresIn, env) {
  // Generate key
  const apiKey = generateApiKey();
  const keyPrefix = apiKey.substring(0, 8) + '...';
  
  // Calculate expiry
  let expiresAt = null;
  if (expiresIn) {
    expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  }
  
  // Store key (hash it for security)
  const keyHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(apiKey)
  );
  const keyHashHex = Array.from(new Uint8Array(keyHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const keyId = nanoid();
  
  await env.DB.prepare(`
    INSERT INTO api_keys (
      id, user_id, name, key_hash, key_prefix, scopes, 
      expires_at, created_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), 1)
  `).bind(
    keyId,
    userId,
    name,
    keyHashHex,
    keyPrefix,
    JSON.stringify(scopes || ['read', 'write']),
    expiresAt
  ).run();
  
  // Log creation
  await env.DB.prepare(`
    INSERT INTO security_audit_log (
      user_id, event_type, event_data, created_at
    ) VALUES (?, ?, ?, unixepoch())
  `).bind(
    userId,
    'API_KEY_CREATED',
    JSON.stringify({ keyId, name, scopes })
  ).run();
  
  return {
    id: keyId,
    name,
    apiKey, // Only returned on creation
    keyPrefix,
    scopes,
    expiresAt,
    createdAt: Date.now()
  };
}

/**
 * Revoke API key
 */
export async function revokeApiKey(userId, keyId, env) {
  // Verify ownership
  const key = await env.DB.prepare(`
    SELECT user_id FROM api_keys WHERE id = ?
  `).bind(keyId).first();
  
  if (!key || key.user_id !== userId) {
    throw new AppError('API key not found', ErrorCategory.VALIDATION, 404);
  }
  
  // Revoke key
  await env.DB.prepare(`
    UPDATE api_keys 
    SET is_active = 0, revoked_at = unixepoch()
    WHERE id = ?
  `).bind(keyId).run();
  
  // Log revocation
  await env.DB.prepare(`
    INSERT INTO security_audit_log (
      user_id, event_type, event_data, created_at
    ) VALUES (?, ?, ?, unixepoch())
  `).bind(
    userId,
    'API_KEY_REVOKED',
    JSON.stringify({ keyId })
  ).run();
  
  return { revoked: true };
}

/**
 * Validate API key
 */
export async function validateApiKey(apiKey, env) {
  // Hash the provided key
  const keyHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(apiKey)
  );
  const keyHashHex = Array.from(new Uint8Array(keyHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Look up key
  const key = await env.DB.prepare(`
    SELECT k.*, u.plan, u.status as user_status
    FROM api_keys k
    JOIN users u ON k.user_id = u.id
    WHERE k.key_hash = ? 
      AND k.is_active = 1
      AND (k.expires_at IS NULL OR k.expires_at > unixepoch())
  `).bind(keyHashHex).first();
  
  if (!key) {
    return null;
  }
  
  // Check if user is active
  if (key.user_status !== 'active') {
    return null;
  }
  
  // Update last used
  await env.DB.prepare(`
    UPDATE api_keys 
    SET last_used_at = unixepoch() 
    WHERE id = ?
  `).bind(key.id).run();
  
  return {
    userId: key.user_id,
    keyId: key.id,
    scopes: JSON.parse(key.scopes),
    plan: key.plan
  };
}

/**
 * Scheduled job to check usage and send notifications
 */
export async function checkAndNotifyUsage(env) {
  // Get users approaching limits
  const users = await env.DB.prepare(`
    SELECT DISTINCT u.id, u.email
    FROM users u
    JOIN links l ON u.id = l.owner_id
    WHERE u.status = 'active'
    GROUP BY u.id
  `).all();
  
  let notificationsSent = 0;
  
  for (const user of users.results || []) {
    try {
      const warnings = await checkUsageWarnings(user.id, env);
      
      if (warnings.length > 0) {
        // Check if we already sent a notification recently
        const recentNotification = await env.DB.prepare(`
          SELECT id FROM usage_notifications
          WHERE user_id = ? 
            AND sent_at > unixepoch() - 86400
            AND notification_type = 'usage_warning'
        `).bind(user.id).first();
        
        if (!recentNotification) {
          await sendUsageNotification(user.id, warnings, env);
          notificationsSent++;
        }
      }
    } catch (error) {
      console.error(`Failed to check usage for user ${user.id}:`, error);
    }
  }
  
  return { checked: users.results.length, notificationsSent };
}