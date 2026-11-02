/**
 * Scheduled Health Checks for Dead Link Monitoring
 * Runs periodic checks on all links to detect dead/broken URLs
 */

import { getConfig } from './config.js';

/**
 * Check if a URL is healthy
 */
async function checkUrlHealth(url, config) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.healthCheckTimeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': config.botUserAgent
      },
      redirect: 'follow'
    });
    
    clearTimeout(timeout);
    
    return {
      healthy: response.ok,
      statusCode: response.status,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

/**
 * Process health check for a single link
 */
async function processLinkHealthCheck(link, env) {
  const config = getConfig(env);
  const linkData = JSON.parse(link.value);
  
  // Check primary URL
  const primaryResult = await checkUrlHealth(linkData.primary, config);
  
  // Determine new status based on health check
  let newStatus = link.status;
  let statusChanged = false;
  
  if (primaryResult.healthy) {
    // Primary is healthy
    if (link.status !== 'live') {
      newStatus = 'live';
      statusChanged = true;
      link.health_check_failures = 0;
    }
  } else {
    // Primary failed
    link.health_check_failures = (link.health_check_failures || 0) + 1;
    
    // After 3 failures, switch to fallback
    if (link.health_check_failures >= 3) {
      if (linkData.fallback_1 && link.status === 'live') {
        newStatus = 'fallback_1';
        statusChanged = true;
      } else if (linkData.fallback_2 && link.status === 'fallback_1') {
        newStatus = 'fallback_2';
        statusChanged = true;
      } else if (linkData.fallback_3 && link.status === 'fallback_2') {
        newStatus = 'fallback_3';
        statusChanged = true;
      } else {
        newStatus = 'dead';
        statusChanged = true;
      }
    }
  }
  
  // Update link status in database
  await env.DB.prepare(`
    UPDATE links 
    SET status = ?, 
        last_health_check = unixepoch(), 
        health_check_failures = ?,
        updated_at = unixepoch()
    WHERE slug = ?
  `).bind(newStatus, link.health_check_failures, link.slug).run();
  
  // Log status change
  if (statusChanged) {
    await env.DB.prepare(`
      INSERT INTO link_status_changes (slug, old_status, new_status, changed_at, reason)
      VALUES (?, ?, ?, unixepoch(), ?)
    `).bind(
      link.slug,
      link.status,
      newStatus,
      `Health check: ${primaryResult.error || `HTTP ${primaryResult.statusCode}`}`
    ).run();
    
    // Send notification if configured
    if (env.WEBHOOK_URL) {
      await sendWebhookNotification(env, {
        event: 'link_status_changed',
        slug: link.slug,
        oldStatus: link.status,
        newStatus: newStatus,
        reason: primaryResult.error || `HTTP ${primaryResult.statusCode}`
      });
    }
  }
  
  return {
    slug: link.slug,
    checked: true,
    statusChanged,
    newStatus
  };
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(env, data) {
  try {
    await fetch(env.WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': env.WEBHOOK_SECRET || ''
      },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Webhook notification failed:', error);
  }
}

/**
 * Run scheduled health checks
 */
export async function runScheduledHealthCheck(env) {
  const config = getConfig(env);
  const startTime = Date.now();
  
  try {
    // Get links that need health checking
    const links = await env.DB.prepare(`
      SELECT slug, status, health_check_failures, last_health_check
      FROM links
      WHERE status != 'disabled' 
        AND status != 'paused'
        AND (last_health_check IS NULL OR last_health_check < unixepoch() - 300)
      ORDER BY last_health_check ASC
      LIMIT ?
    `).bind(config.healthCheckBatchSize).all();
    
    if (!links.results || links.results.length === 0) {
      return {
        checked: 0,
        duration: Date.now() - startTime,
        message: 'No links need checking'
      };
    }
    
    // Process health checks in parallel
    const promises = [];
    for (const link of links.results) {
      // Get full link data from KV
      const linkData = await env.LINKS.get(link.slug);
      if (linkData) {
        link.value = linkData;
        promises.push(processLinkHealthCheck(link, env));
      }
    }
    
    const results = await Promise.allSettled(promises);
    
    // Count results
    let checked = 0;
    let statusChanges = 0;
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.checked) {
        checked++;
        if (result.value.statusChanged) {
          statusChanges++;
        }
      }
    }
    
    // Log run to database
    await env.DB.prepare(`
      INSERT INTO health_check_runs (run_at, links_checked, duration_ms)
      VALUES (unixepoch(), ?, ?)
    `).bind(checked, Date.now() - startTime).run();
    
    return {
      checked,
      statusChanges,
      duration: Date.now() - startTime,
      message: `Checked ${checked} links, ${statusChanges} status changes`
    };
    
  } catch (error) {
    console.error('Health check error:', error);
    return {
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Scheduled handler for Cloudflare Workers
 */
export async function scheduled(event, env, ctx) {
  // Run health checks
  const result = await runScheduledHealthCheck(env);
  
  // Log to analytics if available
  if (env.ANALYTICS) {
    env.ANALYTICS.writeDataPoint({
      blobs: ['scheduled_health_check', result.error ? 'error' : 'success'],
      doubles: [
        result.checked || 0,
        result.statusChanges || 0,
        result.duration
      ],
      indexes: ['health_check_scheduled']
    });
  }
  
  console.log('Scheduled health check completed:', result);
}

/**
 * Manual health check endpoint
 */
export async function handleManualHealthCheck(request, env) {
  // Verify admin access
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey || !apiKey.startsWith('dl_admin_')) {
    return new Response(JSON.stringify({
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const result = await runScheduledHealthCheck(env);
  
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}