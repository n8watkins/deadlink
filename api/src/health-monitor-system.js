/**
 * Comprehensive Health Check Monitoring System
 * Monitors service health, dependencies, and performance metrics
 */

import { getConfig } from './config.js';

/**
 * Health check status enum
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
};

/**
 * Component health check result
 */
class ComponentHealth {
  constructor(name, status, message, metadata = {}) {
    this.name = name;
    this.status = status;
    this.message = message;
    this.metadata = metadata;
    this.checkedAt = new Date().toISOString();
  }
}

/**
 * Health check for database connectivity
 */
async function checkDatabase(env) {
  try {
    const start = Date.now();
    const result = await env.DB.prepare('SELECT 1 as test').first();
    const duration = Date.now() - start;
    
    if (result?.test === 1) {
      return new ComponentHealth(
        'database',
        HealthStatus.HEALTHY,
        'Database is responding',
        { responseTime: duration }
      );
    }
    
    return new ComponentHealth(
      'database',
      HealthStatus.UNHEALTHY,
      'Database returned unexpected result'
    );
  } catch (error) {
    return new ComponentHealth(
      'database',
      HealthStatus.UNHEALTHY,
      `Database error: ${error.message}`
    );
  }
}

/**
 * Health check for KV storage
 */
async function checkKVStorage(env) {
  try {
    const start = Date.now();
    const testKey = '_health_check_test';
    const testValue = Date.now().toString();
    
    // Write test
    await env.LINKS.put(testKey, testValue);
    
    // Read test
    const retrieved = await env.LINKS.get(testKey);
    
    // Cleanup
    await env.LINKS.delete(testKey);
    
    const duration = Date.now() - start;
    
    if (retrieved === testValue) {
      return new ComponentHealth(
        'kv_storage',
        HealthStatus.HEALTHY,
        'KV storage is responding',
        { responseTime: duration }
      );
    }
    
    return new ComponentHealth(
      'kv_storage',
      HealthStatus.UNHEALTHY,
      'KV storage returned unexpected result'
    );
  } catch (error) {
    return new ComponentHealth(
      'kv_storage',
      HealthStatus.UNHEALTHY,
      `KV storage error: ${error.message}`
    );
  }
}

/**
 * Health check for rate limiting
 */
async function checkRateLimit(env) {
  if (!env.RATE_LIMIT) {
    return new ComponentHealth(
      'rate_limit',
      HealthStatus.DEGRADED,
      'Rate limit KV namespace not configured'
    );
  }
  
  try {
    const start = Date.now();
    const testKey = '_health_check_rate_limit';
    
    await env.RATE_LIMIT.put(testKey, '1', { expirationTtl: 10 });
    const value = await env.RATE_LIMIT.get(testKey);
    await env.RATE_LIMIT.delete(testKey);
    
    const duration = Date.now() - start;
    
    if (value === '1') {
      return new ComponentHealth(
        'rate_limit',
        HealthStatus.HEALTHY,
        'Rate limiting is operational',
        { responseTime: duration }
      );
    }
    
    return new ComponentHealth(
      'rate_limit',
      HealthStatus.UNHEALTHY,
      'Rate limit KV returned unexpected result'
    );
  } catch (error) {
    return new ComponentHealth(
      'rate_limit',
      HealthStatus.UNHEALTHY,
      `Rate limit error: ${error.message}`
    );
  }
}

/**
 * Check system resource usage
 */
async function checkResources(env) {
  try {
    // Get database stats
    const linkCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM links'
    ).first();
    
    const userCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first();
    
    const sessionCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM sessions WHERE expires_at > unixepoch()'
    ).first();
    
    // Check if approaching limits
    const config = getConfig(env);
    const metadata = {
      links: linkCount?.count || 0,
      users: userCount?.count || 0,
      activeSessions: sessionCount?.count || 0
    };
    
    // Determine health based on resource usage
    let status = HealthStatus.HEALTHY;
    let message = 'Resource usage within normal limits';
    
    if (metadata.activeSessions > 10000) {
      status = HealthStatus.DEGRADED;
      message = 'High number of active sessions';
    }
    
    return new ComponentHealth('resources', status, message, metadata);
  } catch (error) {
    return new ComponentHealth(
      'resources',
      HealthStatus.UNHEALTHY,
      `Resource check error: ${error.message}`
    );
  }
}

/**
 * Check external dependencies (optional)
 */
async function checkExternalDependencies(env) {
  const dependencies = [];
  
  // Check if Stripe is configured
  if (env.STRIPE_SECRET_KEY) {
    dependencies.push({
      name: 'stripe',
      configured: true
    });
  }
  
  // Check if webhook URL is configured
  if (env.WEBHOOK_URL) {
    dependencies.push({
      name: 'webhook',
      configured: true
    });
  }
  
  return new ComponentHealth(
    'external_dependencies',
    HealthStatus.HEALTHY,
    'External dependencies check',
    { dependencies }
  );
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(env) {
  const start = Date.now();
  const checks = await Promise.allSettled([
    checkDatabase(env),
    checkKVStorage(env),
    checkRateLimit(env),
    checkResources(env),
    checkExternalDependencies(env)
  ]);
  
  const components = [];
  let overallStatus = HealthStatus.HEALTHY;
  let hasErrors = false;
  
  for (const check of checks) {
    if (check.status === 'fulfilled') {
      const component = check.value;
      components.push(component);
      
      if (component.status === HealthStatus.UNHEALTHY) {
        overallStatus = HealthStatus.UNHEALTHY;
        hasErrors = true;
      } else if (component.status === HealthStatus.DEGRADED && overallStatus !== HealthStatus.UNHEALTHY) {
        overallStatus = HealthStatus.DEGRADED;
      }
    } else {
      // Check failed
      components.push(new ComponentHealth(
        'unknown',
        HealthStatus.UNHEALTHY,
        `Health check failed: ${check.reason}`
      ));
      overallStatus = HealthStatus.UNHEALTHY;
      hasErrors = true;
    }
  }
  
  const duration = Date.now() - start;
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    duration,
    components,
    version: '2.0.0',
    environment: getConfig(env).environment
  };
}

/**
 * Health check endpoint handler
 */
export async function handleHealthCheck(request, env) {
  const config = getConfig(env, request);
  
  // Basic health check (fast)
  if (request.url.includes('?basic=true')) {
    return new Response(JSON.stringify({
      status: HealthStatus.HEALTHY,
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: config.environment
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Full health check
  try {
    const health = await performHealthCheck(env);
    const statusCode = health.status === HealthStatus.HEALTHY ? 200 : 
                      health.status === HealthStatus.DEGRADED ? 200 : 503;
    
    return new Response(JSON.stringify(health), {
      status: statusCode,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      error: error.message
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Log health check results to analytics
 */
export async function logHealthCheckResults(env, health) {
  if (!env.ANALYTICS) return;
  
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [
        health.status,
        health.environment,
        health.components.length.toString()
      ],
      doubles: [
        health.duration,
        health.components.filter(c => c.status === HealthStatus.HEALTHY).length,
        health.components.filter(c => c.status === HealthStatus.DEGRADED).length,
        health.components.filter(c => c.status === HealthStatus.UNHEALTHY).length
      ],
      indexes: ['health_check']
    });
  } catch (error) {
    console.error('Failed to log health check to analytics:', error);
  }
}