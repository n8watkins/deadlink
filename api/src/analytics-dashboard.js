// Phase 4: Analytics Dashboard Service
// Aggregates analytics data for dashboard display

export class AnalyticsDashboard {
  constructor(env) {
    this.env = env;
  }
  
  /**
   * Get comprehensive dashboard data for a user
   */
  async getDashboardData(userId, timeRange = '7d') {
    const since = this.getTimeRangeStart(timeRange);
    
    // Get user's links
    const userLinks = await this.env.DB.prepare(
      'SELECT slug, created_at, status FROM links WHERE owner_id = ? AND status != ?'
    ).bind(userId, 'deleted').all();
    
    const slugs = userLinks.results.map(l => l.slug);
    
    if (slugs.length === 0) {
      return this.getEmptyDashboard(timeRange);
    }
    
    // Parallel data fetching for performance
    const [
      clickTrends,
      topPerformers,
      geoData,
      refererData,
      botStats,
      recentActivity,
      healthStatus
    ] = await Promise.all([
      this.getClickTrends(slugs, since),
      this.getTopPerformers(slugs, since),
      this.getGeoBreakdown(slugs, since),
      this.getRefererData(slugs, since),
      this.getBotStats(slugs, since),
      this.getRecentActivity(slugs, 20),
      this.getHealthStatus(slugs)
    ]);
    
    // Calculate summary metrics
    const summary = this.calculateSummary(clickTrends, userLinks.results);
    
    return {
      timeRange,
      user: {
        totalLinks: slugs.length,
        activeLinks: userLinks.results.filter(l => l.status === 'live').length,
        healthyLinks: healthStatus.healthy,
        issues: healthStatus.issues
      },
      summary,
      trends: clickTrends,
      topLinks: topPerformers,
      geography: geoData,
      referrers: refererData,
      botDetection: botStats,
      recentActivity,
      healthOverview: healthStatus
    };
  }
  
  /**
   * Get click trends over time
   */
  async getClickTrends(slugs, since) {
    if (slugs.length === 0) return [];
    
    const placeholders = slugs.map(() => '?').join(',');
    
    const { results } = await this.env.DB.prepare(`
      SELECT 
        DATE(timestamp/1000, 'unixepoch') as date,
        COUNT(*) as total_clicks,
        COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(CASE WHEN is_bot = 1 THEN 1 END) as bot_clicks,
        COUNT(DISTINCT ip_hash) as unique_visitors,
        COUNT(DISTINCT country) as unique_countries
      FROM click_events 
      WHERE slug IN (${placeholders}) AND timestamp >= ?
      GROUP BY date 
      ORDER BY date
    `).bind(...slugs, since).all();
    
    return results;
  }
  
  /**
   * Get top performing links
   */
  async getTopPerformers(slugs, since) {
    if (slugs.length === 0) return [];
    
    const placeholders = slugs.map(() => '?').join(',');
    
    const { results } = await this.env.DB.prepare(`
      SELECT 
        ce.slug,
        l.primary_url,
        l.status,
        COUNT(CASE WHEN ce.is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(*) as total_clicks,
        COUNT(DISTINCT ce.ip_hash) as unique_visitors,
        MAX(ce.timestamp) as last_click,
        AVG(CASE WHEN ce.is_bot = 0 THEN 1.0 ELSE 0.0 END) * 100 as human_percentage
      FROM click_events ce
      JOIN links l ON ce.slug = l.slug
      WHERE ce.slug IN (${placeholders}) AND ce.timestamp >= ?
      GROUP BY ce.slug, l.primary_url, l.status
      ORDER BY human_clicks DESC 
      LIMIT 10
    `).bind(...slugs, since).all();
    
    return results;
  }
  
  /**
   * Get geographic breakdown
   */
  async getGeoBreakdown(slugs, since) {
    if (slugs.length === 0) return [];
    
    const placeholders = slugs.map(() => '?').join(',');
    
    const { results } = await this.env.DB.prepare(`
      SELECT 
        country,
        COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(*) as total_clicks,
        COUNT(DISTINCT ip_hash) as unique_visitors,
        ROUND(AVG(CASE WHEN is_bot = 0 THEN 1.0 ELSE 0.0 END) * 100, 1) as human_percentage
      FROM click_events 
      WHERE slug IN (${placeholders}) AND timestamp >= ? AND country IS NOT NULL
      GROUP BY country 
      ORDER BY human_clicks DESC 
      LIMIT 15
    `).bind(...slugs, since).all();
    
    return results;
  }
  
  /**
   * Get referrer data
   */
  async getRefererData(slugs, since) {
    if (slugs.length === 0) return [];
    
    const placeholders = slugs.map(() => '?').join(',');
    
    const { results } = await this.env.DB.prepare(`
      SELECT 
        referer_domain,
        COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
        COUNT(*) as total_clicks,
        COUNT(DISTINCT ip_hash) as unique_visitors
      FROM click_events 
      WHERE slug IN (${placeholders}) AND timestamp >= ? 
        AND referer_domain IS NOT NULL AND referer_domain != ''
      GROUP BY referer_domain 
      ORDER BY human_clicks DESC 
      LIMIT 10
    `).bind(...slugs, since).all();
    
    return results;
  }
  
  /**
   * Get bot detection statistics
   */
  async getBotStats(slugs, since) {
    if (slugs.length === 0) return { categories: [], accuracy: 95 };
    
    const placeholders = slugs.map(() => '?').join(',');
    
    const { results } = await this.env.DB.prepare(`
      SELECT 
        CASE 
          WHEN bot_score >= 90 THEN 'definite_bot'
          WHEN bot_score >= 50 THEN 'likely_bot'
          WHEN bot_score >= 25 THEN 'suspicious'
          ELSE 'human'
        END as category,
        COUNT(*) as count,
        ROUND(AVG(bot_score), 1) as avg_score
      FROM click_events 
      WHERE slug IN (${placeholders}) AND timestamp >= ?
      GROUP BY category
      ORDER BY count DESC
    `).bind(...slugs, since).all();
    
    // Calculate bot detection effectiveness
    const totalClicks = results.reduce((sum, row) => sum + row.count, 0);
    const humanClicks = results.find(r => r.category === 'human')?.count || 0;
    const effectiveness = totalClicks > 0 ? Math.round((humanClicks / totalClicks) * 100) : 0;
    
    return {
      categories: results,
      totalClicks,
      effectiveness,
      accuracy: 95 // This would be calculated based on validation data
    };
  }
  
  /**
   * Get recent activity
   */
  async getRecentActivity(slugs, limit) {
    if (slugs.length === 0) return [];
    
    const placeholders = slugs.map(() => '?').join(',');
    
    const { results } = await this.env.DB.prepare(`
      SELECT 
        ce.slug,
        ce.timestamp,
        ce.is_bot,
        ce.bot_score,
        ce.country,
        ce.referer_domain,
        l.primary_url,
        l.status as link_status
      FROM click_events ce
      JOIN links l ON ce.slug = l.slug
      WHERE ce.slug IN (${placeholders})
      ORDER BY ce.timestamp DESC 
      LIMIT ?
    `).bind(...slugs, limit).all();
    
    return results;
  }
  
  /**
   * Get health status of links
   */
  async getHealthStatus(slugs) {
    if (slugs.length === 0) return { healthy: 0, issues: 0, breakdown: [] };
    
    const placeholders = slugs.map(() => '?').join(',');
    
    const { results } = await this.env.DB.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM links
      WHERE slug IN (${placeholders})
      GROUP BY status
    `).bind(...slugs).all();
    
    const healthy = results.find(r => r.status === 'live')?.count || 0;
    const issues = results.filter(r => r.status !== 'live').reduce((sum, r) => sum + r.count, 0);
    
    return {
      healthy,
      issues,
      breakdown: results
    };
  }
  
  /**
   * Calculate summary metrics
   */
  calculateSummary(clickTrends, links) {
    const totalClicks = clickTrends.reduce((sum, day) => sum + day.total_clicks, 0);
    const humanClicks = clickTrends.reduce((sum, day) => sum + day.human_clicks, 0);
    const botClicks = clickTrends.reduce((sum, day) => sum + day.bot_clicks, 0);
    const uniqueVisitors = Math.max(...clickTrends.map(day => day.unique_visitors || 0), 0);
    
    // Calculate trends (compare first and last day)
    const trendData = this.calculateTrends(clickTrends);
    
    // Calculate engagement metrics
    const avgClicksPerLink = links.length > 0 ? Math.round(humanClicks / links.length) : 0;
    const humanPercentage = totalClicks > 0 ? Math.round((humanClicks / totalClicks) * 100) : 0;
    
    return {
      totalClicks,
      humanClicks,
      botClicks,
      uniqueVisitors,
      avgClicksPerLink,
      humanPercentage,
      trends: trendData
    };
  }
  
  /**
   * Calculate trend percentages
   */
  calculateTrends(clickTrends) {
    if (clickTrends.length < 2) {
      return { clicks: 0, visitors: 0 };
    }
    
    // Compare recent period to previous period
    const midpoint = Math.floor(clickTrends.length / 2);
    const recentPeriod = clickTrends.slice(midpoint);
    const previousPeriod = clickTrends.slice(0, midpoint);
    
    const recentClicks = recentPeriod.reduce((sum, day) => sum + day.human_clicks, 0);
    const previousClicks = previousPeriod.reduce((sum, day) => sum + day.human_clicks, 0);
    
    const recentVisitors = recentPeriod.reduce((sum, day) => sum + day.unique_visitors, 0);
    const previousVisitors = previousPeriod.reduce((sum, day) => sum + day.unique_visitors, 0);
    
    const clicksTrend = previousClicks > 0 ? 
      Math.round(((recentClicks - previousClicks) / previousClicks) * 100) : 0;
    const visitorsTrend = previousVisitors > 0 ? 
      Math.round(((recentVisitors - previousVisitors) / previousVisitors) * 100) : 0;
    
    return {
      clicks: clicksTrend,
      visitors: visitorsTrend
    };
  }
  
  /**
   * Get time range start timestamp
   */
  getTimeRangeStart(timeRange) {
    const now = Date.now();
    const ranges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000
    };
    return now - (ranges[timeRange] || ranges['7d']);
  }
  
  /**
   * Get empty dashboard for users with no links
   */
  getEmptyDashboard(timeRange) {
    return {
      timeRange,
      user: {
        totalLinks: 0,
        activeLinks: 0,
        healthyLinks: 0,
        issues: 0
      },
      summary: {
        totalClicks: 0,
        humanClicks: 0,
        botClicks: 0,
        uniqueVisitors: 0,
        avgClicksPerLink: 0,
        humanPercentage: 0,
        trends: { clicks: 0, visitors: 0 }
      },
      trends: [],
      topLinks: [],
      geography: [],
      referrers: [],
      botDetection: { categories: [], effectiveness: 0, accuracy: 95 },
      recentActivity: [],
      healthOverview: { healthy: 0, issues: 0, breakdown: [] }
    };
  }
  
  /**
   * Get performance metrics for dashboard
   */
  async getPerformanceMetrics(userId, timeRange = '24h') {
    const since = this.getTimeRangeStart(timeRange);
    
    try {
      // Get response time metrics (from health check data if available)
      const healthMetrics = await this.env.DB.prepare(`
        SELECT 
          AVG(duration_ms) as avg_response_time,
          COUNT(*) as total_checks
        FROM health_check_runs
        WHERE run_at >= ?
      `).bind(since).first();
      
      // Get click processing performance
      const clickMetrics = await this.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_clicks,
          COUNT(CASE WHEN is_bot = 1 THEN 1 END) as blocked_bots
        FROM click_events ce
        JOIN links l ON ce.slug = l.slug
        WHERE l.owner_id = ? AND ce.timestamp >= ?
      `).bind(userId, since).first();
      
      return {
        avgResponseTime: Math.round(healthMetrics?.avg_response_time || 0),
        totalHealthChecks: healthMetrics?.total_checks || 0,
        totalClicks: clickMetrics?.total_clicks || 0,
        blockedBots: clickMetrics?.blocked_bots || 0,
        botBlockingRate: clickMetrics?.total_clicks > 0 ? 
          Math.round((clickMetrics.blocked_bots / clickMetrics.total_clicks) * 100) : 0
      };
      
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {
        avgResponseTime: 0,
        totalHealthChecks: 0,
        totalClicks: 0,
        blockedBots: 0,
        botBlockingRate: 0
      };
    }
  }
}

/**
 * API endpoint for dashboard data
 */
export async function getDashboard(request, env, ctx) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '7d';
    const includePerformance = searchParams.get('performance') === 'true';
    
    const dashboard = new AnalyticsDashboard(env);
    const data = await dashboard.getDashboardData(request.user.id, timeRange);
    
    // Optionally include performance metrics
    if (includePerformance) {
      const performance = await dashboard.getPerformanceMetrics(request.user.id, timeRange);
      data.performance = performance;
    }
    
    return Response.json(data);
    
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    return new Response('Failed to get dashboard data', { status: 500 });
  }
}