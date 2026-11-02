/**
 * Configuration helper for environment-based settings
 */

export function getConfig(env, request) {
  const host = request?.headers?.get('host') || 'localhost:8787';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  
  return {
    // API URLs
    apiBaseUrl: env.API_BASE_URL || `${protocol}://${host}`,
    docsUrl: env.DOCS_URL || 'https://docs.deadlink.io',
    
    // Fallback URLs
    fallback404Url: env.FALLBACK_404_URL || 'https://example.com/404',
    
    // Bot identification
    botUserAgent: env.BOT_USER_AGENT || 'DeadLinkSwitchboard/1.0 (+https://deadlink.io/bot)',
    
    // Environment
    environment: env.ENVIRONMENT || 'development',
    isDevelopment: (env.ENVIRONMENT || 'development') === 'development',
    isProduction: env.ENVIRONMENT === 'production',
    
    // Security
    corsOrigin: env.CORS_ORIGIN || '*',
    
    // Features
    blockBots: env.BLOCK_BOTS === 'true',
    botBlockThreshold: parseInt(env.BOT_BLOCK_THRESHOLD || '90', 10),
    
    // Rate limiting
    rateLimitSignup: parseInt(env.RATE_LIMIT_SIGNUP || '3', 10),
    rateLimitSignupWindow: parseInt(env.RATE_LIMIT_SIGNUP_WINDOW || '60', 10),
    rateLimitSignin: parseInt(env.RATE_LIMIT_SIGNIN || '5', 10),
    rateLimitSigninWindow: parseInt(env.RATE_LIMIT_SIGNIN_WINDOW || '15', 10),
    
    // Health check
    healthCheckBatchSize: parseInt(env.HEALTH_CHECK_BATCH_SIZE || '50', 10),
    healthCheckTimeout: parseInt(env.HEALTH_CHECK_TIMEOUT || '5000', 10),
    healthCheckRetries: parseInt(env.HEALTH_CHECK_RETRIES || '2', 10),
  };
}

/**
 * Get short URL for a slug
 */
export function getShortUrl(slug, config) {
  return `${config.apiBaseUrl}/r/${slug}`;
}

/**
 * Get API endpoint URL
 */
export function getApiUrl(path, config) {
  return `${config.apiBaseUrl}${path}`;
}