// Phase 3: Health Check & Failover System
// Automatic detection of dead links and failover to alternatives

export default {
  // Cron trigger handler
  async scheduled(event, env, ctx) {
    console.log('Starting health check run at:', new Date().toISOString());
    
    try {
      // Get configuration
      const config = {
        batchSize: parseInt(env.HEALTH_CHECK_BATCH_SIZE || '50'),
        timeout: parseInt(env.HEALTH_CHECK_TIMEOUT || '5000'),
        maxRetries: parseInt(env.HEALTH_CHECK_RETRIES || '2')
      };
      
      // Process links in batches
      await processHealthChecks(env, ctx, config);
      
    } catch (error) {
      console.error('Health check failed:', error);
    }
  },
  
  // Manual trigger for testing
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/trigger') {
      // Manually trigger health checks
      ctx.waitUntil(processHealthChecks(env, ctx));
      return new Response('Health check triggered', { status: 200 });
    }
    
    if (url.pathname === '/status') {
      // Get health check status
      const stats = await getHealthCheckStats(env);
      return Response.json(stats);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function processHealthChecks(env, ctx, config = {}) {
  const startTime = Date.now();
  let processed = 0;
  let cursor = null;
  
  do {
    // List links from KV in batches
    const list = await env.LINKS.list({
      limit: config.batchSize || 50,
      cursor
    });
    
    // Process batch in parallel
    const checks = list.keys.map(key => 
      ctx.waitUntil(checkLink(key.name, env, config))
    );
    
    await Promise.allSettled(checks);
    
    processed += list.keys.length;
    cursor = list.list_complete ? null : list.cursor;
    
  } while (cursor);
  
  const duration = Date.now() - startTime;
  console.log(`Health check completed: ${processed} links in ${duration}ms`);
  
  // Store run statistics
  try {
    await env.DB.prepare(
      'INSERT INTO health_check_runs (run_at, links_checked, duration_ms) VALUES (?, ?, ?)'
    ).bind(Date.now(), processed, duration).run();
  } catch (error) {
    console.error('Failed to store health check stats:', error);
  }
}

async function checkLink(slug, env, config) {
  try {
    // Get link data
    const linkData = await env.LINKS.get(slug, 'json');
    if (!linkData) return;
    
    // Skip if recently checked
    const timeSinceCheck = Date.now() - (linkData.last_checked || 0);
    const checkInterval = 3600000; // 1 hour
    if (timeSinceCheck < checkInterval) {
      return;
    }
    
    // Check the current active URL
    const isAlive = await checkUrl(linkData.active_url, config);
    
    // Determine if we need to update
    let needsUpdate = false;
    let newStatus = linkData.status;
    let newActiveUrl = linkData.active_url;
    let oldStatus = linkData.status;
    
    if (!isAlive && linkData.status === 'live') {
      // Primary URL is dead, switch to fallback
      if (linkData.fallback_urls && linkData.fallback_urls.length > 0) {
        // Try fallbacks in order
        for (let i = 0; i < linkData.fallback_urls.length; i++) {
          const fallbackUrl = linkData.fallback_urls[i];
          const fallbackAlive = await checkUrl(fallbackUrl, config);
          
          if (fallbackAlive) {
            newActiveUrl = fallbackUrl;
            newStatus = `fallback_${i + 1}`;
            needsUpdate = true;
            console.log(`Switching ${slug} to fallback: ${fallbackUrl}`);
            break;
          }
        }
        
        if (!needsUpdate) {
          // All URLs are dead
          newStatus = 'dead';
          needsUpdate = true;
          console.log(`All URLs dead for ${slug}`);
        }
      } else {
        // No fallbacks available
        newStatus = 'dead';
        needsUpdate = true;
        console.log(`Primary dead, no fallbacks for ${slug}`);
      }
      
    } else if (isAlive && linkData.status !== 'live') {
      // Current URL is alive, check if primary URL is back online
      if (linkData.primary_url && linkData.primary_url !== linkData.active_url) {
        const primaryAlive = await checkUrl(linkData.primary_url, config);
        if (primaryAlive) {
          newActiveUrl = linkData.primary_url;
          newStatus = 'live';
          needsUpdate = true;
          console.log(`Primary URL recovered for ${slug}`);
        }
      }
    }
    
    // Update link data
    linkData.last_checked = Date.now();
    
    if (needsUpdate) {
      linkData.active_url = newActiveUrl;
      linkData.status = newStatus;
      linkData.status_changed_at = Date.now();
      
      // Log the change in database
      try {
        await env.DB.prepare(
          'INSERT INTO link_status_changes (slug, old_status, new_status, changed_at) VALUES (?, ?, ?, ?)'
        ).bind(slug, oldStatus, newStatus, Date.now()).run();
      } catch (error) {
        console.error(`Failed to log status change for ${slug}:`, error);
      }
    }
    
    // Save updated data to KV
    await env.LINKS.put(slug, JSON.stringify(linkData));
    
  } catch (error) {
    console.error(`Error checking ${slug}:`, error);
  }
}

async function checkUrl(url, config = {}) {
  const timeout = config.timeout || 5000;
  const maxRetries = config.maxRetries || 2;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'DeadLinkSwitchboard/1.0 (+https://deadlink.io/bot)'
        }
      });
      
      clearTimeout(timeoutId);
      
      // Consider successful status codes
      // 2xx = success
      // 3xx = redirect (often indicates product moved)
      if (response.status >= 200 && response.status < 400) {
        return true;
      }
      
      // Special handling for specific status codes
      if (response.status === 404 || response.status === 410) {
        return false; // Definitely dead
      }
      
      // For 5xx errors, retry
      if (response.status >= 500 && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      return false;
      
    } catch (error) {
      // Network errors, timeouts, etc.
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      return false;
    }
  }
  
  return false;
}

async function getHealthCheckStats(env) {
  try {
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_runs,
        AVG(links_checked) as avg_links_per_run,
        AVG(duration_ms) as avg_duration_ms,
        MAX(run_at) as last_run_at
      FROM health_check_runs
      WHERE run_at > ?
    `).bind(Date.now() - 86400000).first(); // Last 24 hours
    
    const statusCounts = await env.DB.prepare(`
      SELECT 
        new_status,
        COUNT(*) as count
      FROM link_status_changes
      WHERE changed_at > ?
      GROUP BY new_status
    `).bind(Date.now() - 86400000).all();
    
    return {
      ...stats,
      status_changes: statusCounts.results || []
    };
  } catch (error) {
    console.error('Failed to get health check stats:', error);
    return {
      total_runs: 0,
      avg_links_per_run: 0,
      avg_duration_ms: 0,
      last_run_at: null,
      status_changes: []
    };
  }
}