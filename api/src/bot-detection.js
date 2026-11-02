// Phase 4: Comprehensive Bot Detection System
// Advanced bot detection with configurable patterns and scoring

export const BOT_DETECTION_CONFIG = {
  // Definitive bot patterns (100% bot score)
  definiteBot: [
    /googlebot/i,
    /bingbot/i,
    /yandexbot/i,
    /baiduspider/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /telegram/i,
    /slackbot/i,
    /discordbot/i,
    /applebot/i,
    /duckduckbot/i
  ],
  
  // Suspicious patterns (75% bot score)
  suspicious: [
    /curl/i,
    /wget/i,
    /python-requests/i,
    /postman/i,
    /insomnia/i,
    /httpclient/i,
    /okhttp/i,
    /apache-httpclient/i,
    /java\//i,
    /go-http-client/i,
    /libwww-perl/i
  ],
  
  // Crawlers (90% bot score)
  crawlers: [
    /spider/i,
    /crawler/i,
    /scraper/i,
    /bot(?!\s*tv)/i, // "bot" but not "bot tv"
    /archiver/i,
    /extractor/i,
    /harvester/i
  ],
  
  // Score weights
  weights: {
    knownBot: 100,
    suspicious: 75,
    crawler: 90,
    missingUserAgent: 50,
    missingAcceptLanguage: 25,
    missingAccept: 25,
    highRequestRate: 30,
    cloudflareBot: 50,
    suspiciousHeaders: 20,
    nonBrowserAccept: 30
  },
  
  // Thresholds
  thresholds: {
    definiteBot: 90,
    likelyBot: 50,
    suspicious: 25
  },
  
  // Rate limiting (requests per minute from same IP)
  rateLimit: {
    suspicious: 60,
    blocked: 120
  },
  
  // Whitelist patterns (always allow)
  whitelist: [
    /googleweblight/i, // Google Web Light for mobile users
    /preview/i // Social media previews
  ]
};

/**
 * Analyze request and calculate bot score
 */
export async function analyzeRequest(request, env) {
  const userAgent = request.headers.get('User-Agent') || '';
  const ip = request.headers.get('CF-Connecting-IP') || 
             request.headers.get('X-Forwarded-For') || '';
  const referer = request.headers.get('Referer') || '';
  const acceptLanguage = request.headers.get('Accept-Language') || '';
  const accept = request.headers.get('Accept') || '';
  
  // Extract Cloudflare data
  const cfData = request.cf || {};
  const country = cfData.country || 'unknown';
  const city = cfData.city || 'unknown';
  const timezone = cfData.timezone || 'unknown';
  const asn = cfData.asn || 0;
  const cfBotScore = parseInt(cfData.botManagement?.score || 0);
  
  // Calculate bot score
  const botScore = await calculateBotScore(request, {
    userAgent,
    ip,
    referer,
    acceptLanguage,
    accept,
    cfBotScore
  }, env);
  
  // Determine if this is a bot
  const isBot = botScore >= BOT_DETECTION_CONFIG.thresholds.likelyBot;
  const category = getBotCategory(botScore);
  
  return {
    userAgent,
    ip: await hashIP(ip, env), // Hash IP for privacy
    referer,
    acceptLanguage,
    accept,
    isBot,
    botScore,
    category,
    cfBotScore,
    country,
    city,
    timezone,
    asn,
    timestamp: Date.now()
  };
}

/**
 * Calculate comprehensive bot score
 */
async function calculateBotScore(request, analytics, env) {
  const config = BOT_DETECTION_CONFIG;
  const userAgent = analytics.userAgent || '';
  let score = 0;
  
  // Check whitelist first
  if (config.whitelist.some(pattern => pattern.test(userAgent))) {
    return 0;
  }
  
  // Check definitive bot patterns
  if (config.definiteBot.some(pattern => pattern.test(userAgent))) {
    score += config.weights.knownBot;
  }
  // Check suspicious patterns
  else if (config.suspicious.some(pattern => pattern.test(userAgent))) {
    score += config.weights.suspicious;
  }
  // Check crawler patterns
  else if (config.crawlers.some(pattern => pattern.test(userAgent))) {
    score += config.weights.crawler;
  }
  
  // Missing headers analysis
  if (!userAgent) score += config.weights.missingUserAgent;
  if (!analytics.acceptLanguage) score += config.weights.missingAcceptLanguage;
  if (!analytics.accept) score += config.weights.missingAccept;
  
  // Accept header analysis
  if (analytics.accept && !analytics.accept.includes('text/html')) {
    score += config.weights.nonBrowserAccept;
  }
  
  // Suspicious header combinations
  if (userAgent && userAgent.length < 10) {
    score += config.weights.suspiciousHeaders;
  }
  
  // Cloudflare bot detection
  if (analytics.cfBotScore > 80) {
    score += config.weights.cloudflareBot;
  }
  
  // Rate limiting check (requests per minute from same IP)
  if (analytics.ip && analytics.ip !== 'unknown') {
    try {
      const rateLimitScore = await checkRateLimit(analytics.ip, env);
      score += rateLimitScore;
    } catch (error) {
      console.error('Rate limit check failed:', error);
    }
  }
  
  return Math.min(100, score);
}

/**
 * Check rate limiting for IP and return score adjustment
 */
async function checkRateLimit(hashedIP, env) {
  if (!env.LINKS) return 0;
  
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const currentWindow = Math.floor(now / windowMs);
  const rateLimitKey = `rate:${hashedIP}:${currentWindow}`;
  
  try {
    const currentRate = parseInt(await env.LINKS.get(rateLimitKey) || '0');
    const newRate = currentRate + 1;
    
    // Update rate counter with TTL
    await env.LINKS.put(rateLimitKey, newRate.toString(), { expirationTtl: 120 });
    
    // Return score based on request rate
    const config = BOT_DETECTION_CONFIG;
    if (newRate > config.rateLimit.blocked) return 50; // Very high rate
    if (newRate > config.rateLimit.suspicious) return config.weights.highRequestRate;
    
    return 0;
  } catch (error) {
    console.error('Rate limit storage error:', error);
    return 0;
  }
}

/**
 * Get bot category based on score
 */
export function getBotCategory(score) {
  const config = BOT_DETECTION_CONFIG;
  
  if (score >= config.thresholds.definiteBot) return 'definite_bot';
  if (score >= config.thresholds.likelyBot) return 'likely_bot';
  if (score >= config.thresholds.suspicious) return 'suspicious';
  return 'human';
}

/**
 * Log click analytics with bot detection
 */
export async function logClickAnalytics(slug, linkData, analytics, env) {
  try {
    // Update link click counts (separate human and bot)
    if (analytics.isBot) {
      await env.DB.prepare(
        'UPDATE links SET bot_clicks = bot_clicks + 1, total_clicks = total_clicks + 1, last_click_at = ? WHERE slug = ?'
      ).bind(analytics.timestamp, slug).run();
    } else {
      await env.DB.prepare(
        'UPDATE links SET human_clicks = human_clicks + 1, total_clicks = total_clicks + 1, last_click_at = ? WHERE slug = ?'
      ).bind(analytics.timestamp, slug).run();
    }
    
    // Extract referer domain for cleaner storage
    let refererDomain = null;
    if (analytics.referer) {
      try {
        refererDomain = new URL(analytics.referer).hostname;
      } catch {
        refererDomain = analytics.referer.substring(0, 255);
      }
    }
    
    // Log detailed click event
    const userAgentHash = await hashString(analytics.userAgent);
    await env.DB.prepare(`
      INSERT INTO click_events (
        slug, 
        timestamp, 
        is_bot, 
        bot_score, 
        country, 
        city,
        referer_domain,
        user_agent_hash,
        ip_hash,
        cf_bot_score,
        asn,
        timezone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      slug,
      analytics.timestamp,
      analytics.isBot ? 1 : 0,
      analytics.botScore,
      analytics.country,
      analytics.city,
      refererDomain,
      userAgentHash,
      analytics.ip,
      analytics.cfBotScore,
      analytics.asn,
      analytics.timezone
    ).run();
    
    // Update global statistics (async, don't wait)
    updateGlobalStats(analytics.isBot, env);
    
    // Log to Analytics Engine if available
    if (env.ANALYTICS && env.ANALYTICS.writeDataPoint) {
      await env.ANALYTICS.writeDataPoint({
        blobs: [
          slug,                                    // blob1: Link slug
          linkData.status || 'unknown',           // blob2: Link status
          analytics.isBot ? 'bot' : 'human',      // blob3: Traffic type
          analytics.country,                      // blob4: Country
          refererDomain || '',                    // blob5: Referer domain
          linkData.owner_id || 'unknown'          // blob6: Owner ID
        ],
        doubles: [
          analytics.timestamp,                    // double1: Timestamp
          analytics.botScore,                     // double2: Bot score
          analytics.cfBotScore,                   // double3: CF bot score
          analytics.asn,                          // double4: ASN
          1                                       // double5: Click count
        ]
      });
    }
    
  } catch (error) {
    console.error('Failed to log analytics:', error);
  }
}

/**
 * Update global statistics
 */
async function updateGlobalStats(isBot, env) {
  try {
    const statName = isBot ? 'bot_clicks' : 'human_clicks';
    await env.DB.prepare(`
      INSERT OR REPLACE INTO global_stats (stat_name, stat_value, updated_at)
      VALUES (?, COALESCE((SELECT stat_value FROM global_stats WHERE stat_name = ?), 0) + 1, ?)
    `).bind(statName, statName, Date.now()).run();
    
    // Also update total clicks
    await env.DB.prepare(`
      INSERT OR REPLACE INTO global_stats (stat_name, stat_value, updated_at)
      VALUES ('total_clicks', COALESCE((SELECT stat_value FROM global_stats WHERE stat_name = 'total_clicks'), 0) + 1, ?)
    `).bind(Date.now()).run();
    
  } catch (error) {
    console.error('Failed to update global stats:', error);
  }
}

/**
 * Hash IP address for privacy compliance using cryptographically secure hash
 */
async function hashIP(ip, env) {
  if (!ip) return 'unknown';
  
  const encoder = new TextEncoder();
  const salt = env.HASH_SALT || env.API_KEY_SALT || 'deadlink-ip-salt-2024';
  const data = encoder.encode(ip + salt);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Hash string for privacy using cryptographically secure hash
 */
async function hashString(str, env) {
  if (!str) return 'unknown';
  
  const encoder = new TextEncoder();
  const salt = env.HASH_SALT || env.API_KEY_SALT || 'deadlink-string-salt-2024';
  const data = encoder.encode(str + salt);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Check if request should be blocked based on bot score
 */
export function shouldBlockBot(analytics, env) {
  const blockBots = env.BLOCK_BOTS === 'true';
  const threshold = parseInt(env.BOT_BLOCK_THRESHOLD || '90');
  
  return blockBots && analytics.botScore >= threshold;
}

/**
 * Get bot detection statistics
 */
export async function getBotDetectionStats(env, timeRange = 24 * 60 * 60 * 1000) {
  try {
    const since = Date.now() - timeRange;
    
    const stats = await env.DB.prepare(`
      SELECT 
        CASE 
          WHEN bot_score >= 90 THEN 'definite_bot'
          WHEN bot_score >= 50 THEN 'likely_bot'
          WHEN bot_score >= 25 THEN 'suspicious'
          ELSE 'human'
        END as category,
        COUNT(*) as count,
        AVG(bot_score) as avg_score
      FROM click_events 
      WHERE timestamp >= ?
      GROUP BY category
    `).bind(since).all();
    
    const totalClicks = stats.results.reduce((sum, row) => sum + row.count, 0);
    
    return {
      timeRange: timeRange,
      totalClicks,
      breakdown: stats.results,
      accuracy: await calculateDetectionAccuracy(env, since)
    };
    
  } catch (error) {
    console.error('Failed to get bot detection stats:', error);
    return null;
  }
}

/**
 * Calculate bot detection accuracy (placeholder - would need labeled data)
 */
async function calculateDetectionAccuracy(env, since) {
  try {
    // This is a simplified accuracy calculation
    // In production, you'd compare against known good/bad traffic
    const accuracy = await env.DB.prepare(
      'SELECT stat_value FROM global_stats WHERE stat_name = ?'
    ).bind('bot_detection_accuracy').first();
    
    return accuracy?.stat_value || 95;
  } catch {
    return 95; // Default accuracy
  }
}