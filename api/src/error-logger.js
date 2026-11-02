/**
 * Error Logging and Tracking System
 * Provides structured error logging, tracking, and alerting
 */

import { getConfig } from './config.js';

/**
 * Error severity levels
 */
export const ErrorSeverity = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Error categories
 */
export const ErrorCategory = {
  AUTH: 'authentication',
  DATABASE: 'database',
  NETWORK: 'network',
  VALIDATION: 'validation',
  RATE_LIMIT: 'rate_limit',
  PERMISSION: 'permission',
  EXTERNAL_SERVICE: 'external_service',
  UNKNOWN: 'unknown'
};

/**
 * Structured error class
 */
export class AppError extends Error {
  constructor(message, category = ErrorCategory.UNKNOWN, statusCode = 500, metadata = {}) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.statusCode = statusCode;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
    this.id = crypto.randomUUID();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      message: this.message,
      category: this.category,
      statusCode: this.statusCode,
      metadata: this.metadata,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Error logger class
 */
export class ErrorLogger {
  constructor(env) {
    this.env = env;
    this.config = getConfig(env);
  }

  /**
   * Log error to database
   */
  async logToDatabase(error, context = {}) {
    try {
      await this.env.DB.prepare(`
        INSERT INTO error_logs (
          id, severity, category, message, stack_trace, 
          metadata, user_id, request_id, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        error.id || crypto.randomUUID(),
        context.severity || ErrorSeverity.ERROR,
        error.category || ErrorCategory.UNKNOWN,
        error.message,
        error.stack || null,
        JSON.stringify({
          ...error.metadata,
          ...context.metadata
        }),
        context.userId || null,
        context.requestId || null,
        Date.now()
      ).run();
    } catch (dbError) {
      // If database logging fails, log to console
      console.error('Failed to log error to database:', dbError);
    }
  }

  /**
   * Log error to analytics
   */
  async logToAnalytics(error, context = {}) {
    if (!this.env.ANALYTICS) return;

    try {
      this.env.ANALYTICS.writeDataPoint({
        blobs: [
          error.category || 'unknown',
          context.severity || 'error',
          error.message.substring(0, 100)
        ],
        doubles: [
          error.statusCode || 500,
          Date.now()
        ],
        indexes: ['error_tracking']
      });
    } catch (analyticsError) {
      console.error('Failed to log error to analytics:', analyticsError);
    }
  }

  /**
   * Send alert for critical errors
   */
  async sendAlert(error, context = {}) {
    if (!this.env.WEBHOOK_URL) return;

    try {
      await fetch(this.env.WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': this.env.WEBHOOK_SECRET || ''
        },
        body: JSON.stringify({
          event: 'critical_error',
          error: error.toJSON ? error.toJSON() : {
            message: error.message,
            stack: error.stack
          },
          context,
          environment: this.config.environment,
          timestamp: new Date().toISOString()
        })
      });
    } catch (alertError) {
      console.error('Failed to send error alert:', alertError);
    }
  }

  /**
   * Main error logging method
   */
  async log(error, context = {}) {
    // Ensure error is properly formatted
    const appError = error instanceof AppError ? error : new AppError(
      error.message || 'Unknown error',
      context.category || ErrorCategory.UNKNOWN,
      error.statusCode || 500,
      error.metadata || {}
    );

    // Add request context
    if (context.request) {
      context.metadata = {
        ...context.metadata,
        url: context.request.url,
        method: context.request.method,
        headers: Object.fromEntries(context.request.headers),
        cf: context.request.cf
      };
    }

    // Log to console in development
    if (this.config.isDevelopment) {
      console.error('Error:', appError.toJSON(), 'Context:', context);
    }

    // Parallel logging to different destinations
    const promises = [
      this.logToDatabase(appError, context),
      this.logToAnalytics(appError, context)
    ];

    // Send alert for critical errors
    if (context.severity === ErrorSeverity.CRITICAL) {
      promises.push(this.sendAlert(appError, context));
    }

    await Promise.allSettled(promises);

    return appError;
  }

  /**
   * Log and format error response
   */
  async logAndRespond(error, context = {}) {
    const appError = await this.log(error, context);
    
    // Don't expose internal error details in production
    const responseBody = this.config.isProduction ? {
      error: 'An error occurred',
      id: appError.id
    } : {
      error: appError.message,
      id: appError.id,
      category: appError.category
    };

    return new Response(JSON.stringify(responseBody), {
      status: appError.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Id': appError.id
      }
    });
  }
}

/**
 * Error tracking middleware
 */
export function withErrorTracking(handler) {
  return async (request, env, ctx) => {
    const logger = new ErrorLogger(env);
    const requestId = crypto.randomUUID();
    
    try {
      // Add request ID to context
      ctx.requestId = requestId;
      
      // Call the handler
      const response = await handler(request, env, ctx);
      
      // Log 5xx errors
      if (response.status >= 500) {
        await logger.log(new AppError(
          `HTTP ${response.status} response`,
          ErrorCategory.UNKNOWN,
          response.status
        ), {
          requestId,
          severity: ErrorSeverity.ERROR
        });
      }
      
      return response;
    } catch (error) {
      // Log unhandled errors
      return await logger.logAndRespond(error, {
        requestId,
        request,
        severity: ErrorSeverity.ERROR
      });
    }
  };
}

/**
 * Create error logs table migration
 */
export const ERROR_LOGS_SCHEMA = `
CREATE TABLE IF NOT EXISTS error_logs (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  metadata TEXT,
  user_id TEXT,
  request_id TEXT,
  timestamp INTEGER NOT NULL,
  resolved INTEGER DEFAULT 0,
  resolved_at INTEGER,
  resolved_by TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_request ON error_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
`;

/**
 * Get error statistics
 */
export async function getErrorStats(env, hours = 24) {
  const since = Date.now() - (hours * 60 * 60 * 1000);
  
  const stats = await env.DB.prepare(`
    SELECT 
      category,
      severity,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as affected_users
    FROM error_logs
    WHERE timestamp > ?
    GROUP BY category, severity
    ORDER BY count DESC
  `).bind(since).all();
  
  return stats.results || [];
}

/**
 * Get recent errors
 */
export async function getRecentErrors(env, limit = 100) {
  const errors = await env.DB.prepare(`
    SELECT *
    FROM error_logs
    ORDER BY timestamp DESC
    LIMIT ?
  `).bind(limit).all();
  
  return errors.results || [];
}

/**
 * Mark error as resolved
 */
export async function resolveError(env, errorId, resolvedBy, notes = null) {
  await env.DB.prepare(`
    UPDATE error_logs
    SET resolved = 1,
        resolved_at = ?,
        resolved_by = ?,
        notes = ?
    WHERE id = ?
  `).bind(Date.now(), resolvedBy, notes, errorId).run();
}