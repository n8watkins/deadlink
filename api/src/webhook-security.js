/**
 * Webhook Security
 * Secure webhook delivery with signatures
 */

import { AppError, ErrorCategory } from './error-logger.js';

/**
 * Generate webhook signature
 */
export async function generateWebhookSignature(payload, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  
  // Import the secret key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Generate signature
  const signature = await crypto.subtle.sign('HMAC', key, data);
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = await generateWebhookSignature(payload, secret);
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Send webhook with retry logic
 */
export async function sendWebhook(url, event, data, secret, env) {
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID()
  };
  
  const signature = await generateWebhookSignature(payload, secret);
  
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': payload.timestamp,
          'X-Webhook-Event': event,
          'X-Webhook-ID': payload.id,
          'User-Agent': 'DeadLinkSwitchboard/1.0'
        },
        body: JSON.stringify(payload)
      });
      
      // Log webhook delivery
      await env.DB.prepare(`
        INSERT INTO webhook_deliveries (
          webhook_id, event, url, status_code, attempt, 
          delivered_at, response_time, success
        ) VALUES (?, ?, ?, ?, ?, unixepoch(), ?, ?)
      `).bind(
        payload.id,
        event,
        url,
        response.status,
        attempt + 1,
        Date.now() - new Date(payload.timestamp).getTime(),
        response.ok ? 1 : 0
      ).run();
      
      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          attempts: attempt + 1
        };
      }
      
      lastError = new Error(`HTTP ${response.status}`);
      
      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        break;
      }
      
    } catch (error) {
      lastError = error;
      console.error(`Webhook delivery attempt ${attempt + 1} failed:`, error);
    }
    
    // Exponential backoff
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  // All attempts failed
  throw new AppError(
    `Webhook delivery failed: ${lastError.message}`,
    ErrorCategory.EXTERNAL_SERVICE,
    500
  );
}

/**
 * Register webhook endpoint
 */
export async function registerWebhook(userId, url, events, env) {
  // Validate URL
  try {
    const webhookUrl = new URL(url);
    if (!['http:', 'https:'].includes(webhookUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch (error) {
    throw new AppError('Invalid webhook URL', ErrorCategory.VALIDATION, 400);
  }
  
  // Generate webhook secret
  const secret = crypto.randomUUID().replace(/-/g, '');
  const webhookId = crypto.randomUUID();
  
  // Store webhook
  await env.DB.prepare(`
    INSERT INTO webhooks (
      id, user_id, url, secret, events, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, 1, unixepoch())
  `).bind(
    webhookId,
    userId,
    url,
    secret,
    JSON.stringify(events)
  ).run();
  
  // Send test webhook
  try {
    await sendWebhook(url, 'webhook.test', { message: 'Webhook registered successfully' }, secret, env);
  } catch (error) {
    // Delete webhook if test fails
    await env.DB.prepare(`DELETE FROM webhooks WHERE id = ?`).bind(webhookId).run();
    throw new AppError('Webhook test failed', ErrorCategory.EXTERNAL_SERVICE, 400);
  }
  
  return {
    id: webhookId,
    url,
    secret, // Only returned on creation
    events,
    active: true
  };
}

/**
 * List user's webhooks
 */
export async function listWebhooks(userId, env) {
  const webhooks = await env.DB.prepare(`
    SELECT id, url, events, is_active, created_at, last_triggered_at
    FROM webhooks
    WHERE user_id = ? AND is_active = 1
    ORDER BY created_at DESC
  `).bind(userId).all();
  
  return webhooks.results || [];
}

/**
 * Delete webhook
 */
export async function deleteWebhook(userId, webhookId, env) {
  const webhook = await env.DB.prepare(`
    SELECT user_id FROM webhooks WHERE id = ?
  `).bind(webhookId).first();
  
  if (!webhook || webhook.user_id !== userId) {
    throw new AppError('Webhook not found', ErrorCategory.VALIDATION, 404);
  }
  
  await env.DB.prepare(`
    UPDATE webhooks SET is_active = 0 WHERE id = ?
  `).bind(webhookId).run();
  
  return { deleted: true };
}

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhooks(event, data, userId, env) {
  const webhooks = await env.DB.prepare(`
    SELECT id, url, secret FROM webhooks
    WHERE user_id = ? 
      AND is_active = 1
      AND json_extract(events, '$') LIKE ?
  `).bind(userId, `%"${event}"%`).all();
  
  const results = [];
  
  for (const webhook of webhooks.results || []) {
    try {
      const result = await sendWebhook(webhook.url, event, data, webhook.secret, env);
      results.push({ webhookId: webhook.id, ...result });
      
      // Update last triggered
      await env.DB.prepare(`
        UPDATE webhooks SET last_triggered_at = unixepoch() WHERE id = ?
      `).bind(webhook.id).run();
    } catch (error) {
      results.push({
        webhookId: webhook.id,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}