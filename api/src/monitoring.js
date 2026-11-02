/**
 * Phase 8: Production Monitoring and Alerting System
 * Comprehensive observability for Dead Link Switchboard
 */

export class MonitoringManager {
  constructor(env) {
    this.env = env;
    this.metrics = new Map();
  }

  /**
   * Record performance metrics
   */
  async recordMetric(name, value, dimensions = {}) {
    try {
      await this.env.DB.prepare(`
        INSERT INTO performance_metrics (metric_name, metric_value, dimensions, timestamp)
        VALUES (?, ?, ?, ?)
      `).bind(name, value, JSON.stringify(dimensions), Date.now()).run();

      // Also store in memory for immediate access
      const key = `${name}:${JSON.stringify(dimensions)}`;
      this.metrics.set(key, { value, timestamp: Date.now() });
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  /**
   * Record system health status
   */
  async recordHealth(component, status, details = {}) {
    try {
      await this.env.DB.prepare(`
        INSERT INTO system_health (component, status, details, timestamp)
        VALUES (?, ?, ?, ?)
      `).bind(component, status, JSON.stringify(details), Date.now()).run();

      // Check if this is a status change that needs alerting
      if (status === 'down' || status === 'degraded') {
        await this.triggerAlert('health_check_failed', {
          component,
          status,
          details
        });
      }
    } catch (error) {
      console.error('Failed to record health:', error);
    }
  }

  /**
   * Record error events for debugging and alerting
   */
  async recordError(errorType, error, requestData = {}) {
    try {
      const errorData = {
        error_type: errorType,
        error_message: error.message?.substring(0, 1000) || 'Unknown error',
        stack_trace: error.stack?.substring(0, 5000) || null,
        request_data: JSON.stringify(requestData).substring(0, 2000),
        user_id: requestData.user?.id || null,
        ip_address: requestData.ip || null,
        timestamp: Date.now()
      };

      await this.env.DB.prepare(`
        INSERT INTO error_events (
          error_type, error_message, stack_trace, request_data, 
          user_id, ip_address, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        errorData.error_type,
        errorData.error_message,
        errorData.stack_trace,
        errorData.request_data,
        errorData.user_id,
        errorData.ip_address,
        errorData.timestamp
      ).run();

      // Check error rate for alerting
      await this.checkErrorRateThreshold(errorType);
    } catch (err) {
      console.error('Failed to record error:', err);
    }
  }

  /**
   * Check if error rate exceeds threshold and trigger alerts
   */
  async checkErrorRateThreshold(errorType) {
    try {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const recentErrors = await this.env.DB.prepare(`
        SELECT COUNT(*) as error_count
        FROM error_events
        WHERE error_type = ? AND timestamp >= ?
      `).bind(errorType, fiveMinutesAgo).first();

      // Alert if more than 10 errors of same type in 5 minutes
      if (recentErrors?.error_count > 10) {
        await this.triggerAlert('error_rate_exceeded', {
          error_type: errorType,
          count: recentErrors.error_count,
          time_window: '5 minutes'
        });
      }
    } catch (error) {
      console.error('Failed to check error rate:', error);
    }
  }

  /**
   * Performance monitoring middleware
   */
  async measurePerformance(operationName, operation, dimensions = {}) {
    const startTime = Date.now();
    let success = true;
    let error = null;

    try {
      const result = await operation();
      return result;
    } catch (err) {
      success = false;
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      // Record performance metrics
      await this.recordMetric(`${operationName}_duration_ms`, duration, {
        ...dimensions,
        success
      });

      // Record error if operation failed
      if (error) {
        await this.recordError(`${operationName}_error`, error, dimensions);
      }

      // Log slow operations
      if (duration > 1000) { // > 1 second
        console.warn(`Slow operation detected: ${operationName} took ${duration}ms`);
        await this.recordMetric('slow_operation', 1, {
          operation: operationName,
          duration,
          ...dimensions
        });
      }
    }
  }

  /**
   * Get real-time metrics for dashboard
   */
  async getMetrics(timeRange = '1h') {
    const timeRangeMs = this.parseTimeRange(timeRange);
    const since = Date.now() - timeRangeMs;

    try {
      const metrics = await this.env.DB.prepare(`
        SELECT 
          metric_name,
          AVG(metric_value) as avg_value,
          MIN(metric_value) as min_value,
          MAX(metric_value) as max_value,
          COUNT(*) as data_points
        FROM performance_metrics
        WHERE timestamp >= ?
        GROUP BY metric_name
        ORDER BY metric_name
      `).bind(since).all();

      const healthStatus = await this.env.DB.prepare(`
        SELECT component, status, COUNT(*) as count
        FROM system_health
        WHERE timestamp >= ?
        GROUP BY component, status
        ORDER BY component
      `).bind(since).all();

      const errorSummary = await this.env.DB.prepare(`
        SELECT error_type, COUNT(*) as error_count
        FROM error_events
        WHERE timestamp >= ?
        GROUP BY error_type
        ORDER BY error_count DESC
        LIMIT 10
      `).bind(since).all();

      return {
        time_range: timeRange,
        generated_at: new Date().toISOString(),
        metrics: metrics.results || [],
        health_status: healthStatus.results || [],
        error_summary: errorSummary.results || []
      };
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return { error: 'Failed to retrieve metrics' };
    }
  }

  /**
   * Get system health dashboard data
   */
  async getHealthDashboard() {
    try {
      const overallHealth = await this.env.DB.prepare(`
        SELECT * FROM health_status ORDER BY component
      `).all();

      const recentErrors = await this.env.DB.prepare(`
        SELECT error_type, COUNT(*) as count, MAX(timestamp) as latest
        FROM error_events
        WHERE timestamp >= ?
        GROUP BY error_type
        ORDER BY count DESC
        LIMIT 5
      `).bind(Date.now() - 3600000).all(); // Last hour

      const performanceMetrics = await this.env.DB.prepare(`
        SELECT 
          metric_name,
          AVG(metric_value) as average,
          COUNT(*) as samples
        FROM performance_metrics
        WHERE timestamp >= ? AND metric_name LIKE '%_duration_ms'
        GROUP BY metric_name
        ORDER BY average DESC
      `).bind(Date.now() - 3600000).all(); // Last hour

      return {
        overall_status: this.calculateOverallHealth(overallHealth.results),
        component_health: overallHealth.results || [],
        recent_errors: recentErrors.results || [],
        performance_summary: performanceMetrics.results || [],
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get health dashboard:', error);
      return { 
        overall_status: 'unknown',
        error: 'Failed to retrieve health data' 
      };
    }
  }

  /**
   * Calculate overall system health status
   */
  calculateOverallHealth(componentHealth) {
    if (!componentHealth || componentHealth.length === 0) {
      return 'unknown';
    }

    const hasDown = componentHealth.some(h => h.status === 'down');
    const hasDegraded = componentHealth.some(h => h.status === 'degraded');

    if (hasDown) return 'down';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }

  /**
   * Trigger alert to external systems
   */
  async triggerAlert(alertType, details) {
    try {
      const alert = {
        type: alertType,
        details,
        timestamp: new Date().toISOString(),
        severity: this.getAlertSeverity(alertType)
      };

      // Log alert locally
      console.warn('ALERT TRIGGERED:', JSON.stringify(alert));

      // Send to external monitoring systems (if configured)
      if (this.env.WEBHOOK_URL) {
        await fetch(this.env.WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        });
      }

      // Store alert in database for tracking
      await this.env.DB.prepare(`
        INSERT INTO security_events (event_type, details, timestamp)
        VALUES (?, ?, ?)
      `).bind('alert_triggered', JSON.stringify(alert), Date.now()).run();

    } catch (error) {
      console.error('Failed to trigger alert:', error);
    }
  }

  /**
   * Determine alert severity level
   */
  getAlertSeverity(alertType) {
    const severityMap = {
      'health_check_failed': 'high',
      'error_rate_exceeded': 'high',
      'rate_limit_exceeded': 'medium',
      'slow_operation': 'low',
      'bot_detection': 'low'
    };
    return severityMap[alertType] || 'medium';
  }

  /**
   * Parse time range string to milliseconds
   */
  parseTimeRange(timeRange) {
    const ranges = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    return ranges[timeRange] || ranges['1h'];
  }

  /**
   * Cleanup old monitoring data
   */
  async cleanupOldData() {
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

      // Cleanup performance metrics (keep 30 days)
      await this.env.DB.prepare(
        'DELETE FROM performance_metrics WHERE timestamp < ?'
      ).bind(thirtyDaysAgo).run();

      // Cleanup system health (keep 7 days)
      await this.env.DB.prepare(
        'DELETE FROM system_health WHERE timestamp < ?'
      ).bind(sevenDaysAgo).run();

      // Cleanup rate limits (keep 1 day)
      await this.env.DB.prepare(
        'DELETE FROM rate_limits WHERE expires_at < ?'
      ).bind(oneDayAgo).run();

      console.log('Monitoring data cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup monitoring data:', error);
    }
  }
}

/**
 * Monitoring middleware for request tracking
 */
export class RequestMonitoring {
  constructor(monitoringManager) {
    this.monitor = monitoringManager;
  }

  /**
   * Wrap request handler with monitoring
   */
  withMonitoring(handlerName, handler) {
    return async (request, env, ctx) => {
      const startTime = Date.now();
      const requestId = crypto.randomUUID();
      
      // Add request context
      request.monitoringContext = {
        requestId,
        startTime,
        handlerName
      };

      try {
        const result = await this.monitor.measurePerformance(
          handlerName,
          () => handler(request, env, ctx),
          {
            method: request.method,
            url: new URL(request.url).pathname
          }
        );

        // Record successful request
        await this.monitor.recordMetric('request_success', 1, {
          handler: handlerName,
          method: request.method,
          status: result.status || 200
        });

        return result;
      } catch (error) {
        // Record failed request
        await this.monitor.recordMetric('request_failure', 1, {
          handler: handlerName,
          method: request.method,
          error: error.name
        });

        await this.monitor.recordError('request_handler_error', error, {
          handler: handlerName,
          method: request.method,
          url: request.url,
          requestId
        });

        throw error;
      }
    };
  }
}

export default MonitoringManager;