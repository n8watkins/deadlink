/**
 * Phase 8: Advanced Security Hardening
 * Addresses critical Phase 7 findings and implements production-grade security
 */

export class SecurityManager {
  constructor(env) {
    this.env = env;
    // Use environment variable for cryptographic salt (fixes Phase 7 critical issue)
    this.hashSalt = env.CRYPTO_HASH_SALT || this.generateSecureSalt();
  }

  /**
   * Generate cryptographically secure salt if not provided
   * Addresses Phase 7 Critical Issue #1: Hard-coded salts
   */
  generateSecureSalt() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Secure hash function with environment-based salt
   * Fixes Phase 7 Critical Issue #1
   */
  async secureHash(input, purpose = 'general') {
    if (!input) return 'unknown';
    
    const encoder = new TextEncoder();
    const saltedInput = `${input}:${purpose}:${this.hashSalt}`;
    const data = encoder.encode(saltedInput);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }

  /**
   * Advanced rate limiting with multiple time windows
   * Addresses Phase 7 Critical Issue #3: Bypassable rate limiting
   */
  async advancedRateLimit(request, identifier, limits) {
    const patterns = [
      { window: 60, max: limits.perMinute || 60 },      // 1 minute
      { window: 3600, max: limits.perHour || 1000 },   // 1 hour  
      { window: 86400, max: limits.perDay || 10000 }   // 1 day
    ];

    for (const pattern of patterns) {
      const windowStart = Math.floor(Date.now() / (pattern.window * 1000));
      const key = `rate:${identifier}:${pattern.window}:${windowStart}`;
      
      try {
        // Use D1 for persistent rate limiting (fixes bypassable KV rate limiting)
        const result = await this.env.DB.prepare(`
          INSERT OR IGNORE INTO rate_limits (key, count, expires_at) 
          VALUES (?, 0, ?)
        `).bind(key, Date.now() + (pattern.window * 1000 * 2)).run();

        const current = await this.env.DB.prepare(`
          UPDATE rate_limits 
          SET count = count + 1 
          WHERE key = ? AND expires_at > ?
          RETURNING count
        `).bind(key, Date.now()).first();

        if (!current) {
          // Key expired, create new one
          await this.env.DB.prepare(`
            INSERT OR REPLACE INTO rate_limits (key, count, expires_at) 
            VALUES (?, 1, ?)
          `).bind(key, Date.now() + (pattern.window * 1000 * 2)).run();
          continue;
        }

        if (current.count > pattern.max) {
          // Log security event
          await this.logSecurityEvent('rate_limit_exceeded', {
            identifier,
            limit: pattern.max,
            current: current.count,
            window: pattern.window,
            ip: request.headers.get('CF-Connecting-IP'),
            userAgent: request.headers.get('User-Agent')?.substring(0, 255)
          });

          return {
            blocked: true,
            reason: `Rate limit exceeded: ${current.count}/${pattern.max} per ${pattern.window}s`,
            retryAfter: pattern.window,
            windowType: pattern.window === 60 ? 'minute' : pattern.window === 3600 ? 'hour' : 'day'
          };
        }
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Fail open but log the issue
        await this.logSecurityEvent('rate_limit_error', {
          identifier,
          error: error.message
        });
      }
    }
    
    return { blocked: false };
  }

  /**
   * Comprehensive input validation and sanitization
   */
  validateAndSanitize(data, schema) {
    const errors = [];
    const sanitized = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      // Required field check
      if (rules.required && (!value || value.toString().trim() === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      
      if (!value && value !== 0) {
        sanitized[field] = rules.default || null;
        continue;
      }

      // Type validation
      switch (rules.type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${field} must be a valid email`);
          } else {
            sanitized[field] = value.toLowerCase().trim();
          }
          break;
          
        case 'url':
          try {
            const url = new URL(value);
            if (!['http:', 'https:'].includes(url.protocol)) {
              errors.push(`${field} must use HTTP or HTTPS`);
            } else {
              sanitized[field] = url.toString();
            }
          } catch {
            errors.push(`${field} must be a valid URL`);
          }
          break;
          
        case 'string':
          const strValue = value.toString();
          if (rules.maxLength && strValue.length > rules.maxLength) {
            errors.push(`${field} must be less than ${rules.maxLength} characters`);
          } else if (rules.minLength && strValue.length < rules.minLength) {
            errors.push(`${field} must be at least ${rules.minLength} characters`);
          } else {
            // Enhanced sanitization
            let sanitizedStr = strValue;
            
            // Remove dangerous characters
            if (rules.sanitize !== false) {
              sanitizedStr = sanitizedStr.replace(/[<>\"'&\x00-\x1f\x7f-\x9f]/g, '');
            }
            
            // Apply length limit
            if (rules.maxLength) {
              sanitizedStr = sanitizedStr.substring(0, rules.maxLength);
            }
            
            sanitized[field] = sanitizedStr.trim();
          }
          break;
          
        case 'integer':
          const intValue = parseInt(value);
          if (isNaN(intValue)) {
            errors.push(`${field} must be a valid integer`);
          } else if (rules.min !== undefined && intValue < rules.min) {
            errors.push(`${field} must be at least ${rules.min}`);
          } else if (rules.max !== undefined && intValue > rules.max) {
            errors.push(`${field} must be no more than ${rules.max}`);
          } else {
            sanitized[field] = intValue;
          }
          break;
          
        case 'slug':
          if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
            errors.push(`${field} must contain only letters, numbers, hyphens, and underscores`);
          } else if (value.length < 3 || value.length > 50) {
            errors.push(`${field} must be between 3 and 50 characters`);
          } else {
            sanitized[field] = value.toLowerCase();
          }
          break;
          
        default:
          sanitized[field] = value;
      }
    }

    return { errors, sanitized, isValid: errors.length === 0 };
  }

  /**
   * Security event logging for monitoring and compliance
   */
  async logSecurityEvent(eventType, details) {
    try {
      await this.env.DB.prepare(`
        INSERT INTO security_events (
          event_type, 
          details, 
          ip_address, 
          user_agent,
          timestamp
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        eventType,
        JSON.stringify(details),
        details.ip || 'unknown',
        details.userAgent || null,
        Date.now()
      ).run();
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Advanced bot detection with machine learning patterns
   */
  async detectAdvancedBot(request) {
    const userAgent = request.headers.get('User-Agent') || '';
    const ip = request.headers.get('CF-Connecting-IP') || '';
    
    let botScore = 0;
    const indicators = [];

    // Cloudflare Bot Score (if available)
    const cfBotScore = request.cf?.botManagement?.score;
    if (cfBotScore !== undefined) {
      botScore += cfBotScore < 30 ? 50 : 0;
      if (cfBotScore < 30) indicators.push('cf_bot_score_low');
    }

    // User-Agent analysis
    const botPatterns = [
      /bot|crawler|spider|scraper|facebookexternalhit|twitterbot|linkedinbot/i,
      /curl|wget|httpie|postman|insomnia/i,
      /python|java|go-http|php|ruby/i
    ];

    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        botScore += 30;
        indicators.push('ua_bot_pattern');
        break;
      }
    }

    // Suspicious User-Agent characteristics
    if (userAgent.length < 20) {
      botScore += 20;
      indicators.push('ua_too_short');
    }

    if (!userAgent.includes('Mozilla') && !botPatterns[0].test(userAgent)) {
      botScore += 15;
      indicators.push('ua_no_mozilla');
    }

    // Rate-based detection
    const recentRequests = await this.env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM security_events 
      WHERE ip_address = ? 
        AND timestamp > ? 
        AND event_type = 'request_logged'
    `).bind(ip, Date.now() - 60000).first(); // Last minute

    if (recentRequests && recentRequests.count > 10) {
      botScore += 25;
      indicators.push('high_request_rate');
    }

    // Missing common headers
    const commonHeaders = ['Accept', 'Accept-Language', 'Accept-Encoding'];
    const missingHeaders = commonHeaders.filter(h => !request.headers.get(h));
    
    if (missingHeaders.length >= 2) {
      botScore += 20;
      indicators.push('missing_headers');
    }

    // Log detection for analysis
    await this.logSecurityEvent('bot_detection', {
      ip,
      userAgent: userAgent.substring(0, 255),
      botScore,
      indicators,
      cfBotScore,
      isBot: botScore >= 50
    });

    return {
      botScore,
      isBot: botScore >= 50,
      indicators,
      confidence: Math.min(100, botScore)
    };
  }

  /**
   * Content Security Policy headers
   */
  getSecurityHeaders(isAPI = false) {
    const baseHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    };

    if (isAPI) {
      return {
        ...baseHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      };
    }

    return {
      ...baseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "font-src 'self'",
        "frame-ancestors 'none'"
      ].join('; ')
    };
  }

  /**
   * Comprehensive request validation middleware
   */
  async validateRequest(request, options = {}) {
    const startTime = Date.now();
    const validation = {
      isValid: true,
      errors: [],
      securityFlags: [],
      metrics: {}
    };

    try {
      // Rate limiting check
      const identifier = options.identifier || 
        request.headers.get('CF-Connecting-IP') || 
        'anonymous';
      
      const rateLimitResult = await this.advancedRateLimit(request, identifier, {
        perMinute: options.rateLimits?.perMinute || 60,
        perHour: options.rateLimits?.perHour || 1000,
        perDay: options.rateLimits?.perDay || 10000
      });

      if (rateLimitResult.blocked) {
        validation.isValid = false;
        validation.errors.push(rateLimitResult.reason);
        validation.securityFlags.push('rate_limited');
        validation.rateLimitInfo = rateLimitResult;
      }

      // Bot detection
      if (options.checkBots !== false) {
        const botDetection = await this.detectAdvancedBot(request);
        validation.botDetection = botDetection;
        
        if (botDetection.isBot && options.blockBots) {
          validation.isValid = false;
          validation.errors.push('Automated traffic not allowed');
          validation.securityFlags.push('bot_blocked');
        }
      }

      // Input validation
      if (options.schema && request.method === 'POST') {
        try {
          const body = await request.json();
          const validationResult = this.validateAndSanitize(body, options.schema);
          
          if (!validationResult.isValid) {
            validation.isValid = false;
            validation.errors.push(...validationResult.errors);
            validation.securityFlags.push('invalid_input');
          }
          
          validation.sanitizedData = validationResult.sanitized;
        } catch (error) {
          validation.isValid = false;
          validation.errors.push('Invalid JSON payload');
          validation.securityFlags.push('json_parse_error');
        }
      }

      validation.metrics.validationTime = Date.now() - startTime;
      return validation;

    } catch (error) {
      console.error('Request validation error:', error);
      validation.isValid = false;
      validation.errors.push('Internal validation error');
      validation.securityFlags.push('validation_error');
      return validation;
    }
  }
}

/**
 * Database schema for security features
 */
export const SECURITY_SCHEMA = `
-- Rate limiting table (fixes Phase 7 Critical Issue #3)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- Security events logging
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  details TEXT, -- JSON
  ip_address TEXT,
  user_agent TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_time ON security_events(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_time ON security_events(ip_address, timestamp);

-- Clean up old rate limits (run periodically)
-- DELETE FROM rate_limits WHERE expires_at < strftime('%s', 'now') * 1000;

-- Clean up old security events (keep 90 days)
-- DELETE FROM security_events WHERE timestamp < (strftime('%s', 'now') - 7776000) * 1000;
`;