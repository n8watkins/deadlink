/**
 * Phase 8: Load Testing and Performance Validation
 * Comprehensive testing suite for production readiness
 */

import { MonitoringManager } from '../src/monitoring.js';

class LoadTester {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.results = {};
  }

  /**
   * Run comprehensive load testing suite
   */
  async runLoadTests() {
    console.log('🚀 Starting Dead Link Switchboard Load Tests');
    console.log('============================================');

    const tests = [
      { name: 'Redirect Performance', fn: () => this.testRedirectPerformance() },
      { name: 'API Endpoint Load', fn: () => this.testAPILoad() },
      { name: 'Concurrent User Simulation', fn: () => this.testConcurrentUsers() },
      { name: 'Database Performance', fn: () => this.testDatabaseLoad() },
      { name: 'Rate Limiting Validation', fn: () => this.testRateLimiting() },
      { name: 'Bot Detection Load', fn: () => this.testBotDetectionLoad() },
      { name: 'Analytics Query Performance', fn: () => this.testAnalyticsPerformance() },
      { name: 'Health Check Stress Test', fn: () => this.testHealthCheckStress() }
    ];

    for (const test of tests) {
      console.log(`\n🧪 Running: ${test.name}`);
      try {
        const result = await test.fn();
        this.results[test.name] = { success: true, ...result };
        console.log(`   ✅ ${test.name} completed`);
      } catch (error) {
        this.results[test.name] = { success: false, error: error.message };
        console.log(`   ❌ ${test.name} failed: ${error.message}`);
      }
    }

    this.generateReport();
  }

  /**
   * Test redirect performance under load
   */
  async testRedirectPerformance() {
    const testUrl = `${this.baseUrl}/r/test123`;
    const concurrency = 50;
    const totalRequests = 1000;
    const batchSize = totalRequests / concurrency;

    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(this.runRedirectBatch(testUrl, batchSize));
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    const flatResults = results.flat();
    const successful = flatResults.filter(r => r.success).length;
    const avgResponseTime = flatResults.reduce((sum, r) => sum + r.responseTime, 0) / flatResults.length;
    const p95ResponseTime = this.calculatePercentile(flatResults.map(r => r.responseTime), 95);
    const p99ResponseTime = this.calculatePercentile(flatResults.map(r => r.responseTime), 99);

    return {
      totalRequests,
      successful,
      successRate: (successful / totalRequests) * 100,
      totalTime: endTime - startTime,
      requestsPerSecond: totalRequests / ((endTime - startTime) / 1000),
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      target: {
        successRate: 99.5,
        avgResponseTime: 100,
        p95ResponseTime: 200,
        p99ResponseTime: 500
      }
    };
  }

  /**
   * Run batch of redirect requests
   */
  async runRedirectBatch(url, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
      const startTime = Date.now();
      try {
        const response = await fetch(url, { 
          method: 'GET',
          redirect: 'manual'
        });
        results.push({
          success: response.status === 302,
          responseTime: Date.now() - startTime,
          status: response.status
        });
      } catch (error) {
        results.push({
          success: false,
          responseTime: Date.now() - startTime,
          error: error.message
        });
      }
    }
    return results;
  }

  /**
   * Test API endpoints under load
   */
  async testAPILoad() {
    const endpoints = [
      { path: '/api/v1/links', method: 'GET' },
      { path: '/api/v1/analytics/overview', method: 'GET' },
      { path: '/api/v1/health', method: 'GET' }
    ];

    const results = {};

    for (const endpoint of endpoints) {
      const concurrency = 25;
      const requestsPerWorker = 40;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrency; i++) {
        promises.push(this.runAPIBatch(endpoint, requestsPerWorker));
      }

      const batchResults = await Promise.all(promises);
      const flatResults = batchResults.flat();
      const endTime = Date.now();

      const successful = flatResults.filter(r => r.success).length;
      const avgResponseTime = flatResults.reduce((sum, r) => sum + r.responseTime, 0) / flatResults.length;

      results[endpoint.path] = {
        totalRequests: concurrency * requestsPerWorker,
        successful,
        successRate: (successful / (concurrency * requestsPerWorker)) * 100,
        avgResponseTime,
        requestsPerSecond: (concurrency * requestsPerWorker) / ((endTime - startTime) / 1000)
      };
    }

    return results;
  }

  /**
   * Run batch of API requests
   */
  async runAPIBatch(endpoint, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        });
        results.push({
          success: response.ok,
          responseTime: Date.now() - startTime,
          status: response.status
        });
      } catch (error) {
        results.push({
          success: false,
          responseTime: Date.now() - startTime,
          error: error.message
        });
      }
    }
    return results;
  }

  /**
   * Simulate concurrent users with mixed traffic
   */
  async testConcurrentUsers() {
    const userCount = 100;
    const sessionDuration = 30000; // 30 seconds
    const actions = ['redirect', 'api_call', 'create_link', 'view_analytics'];

    const promises = [];
    const startTime = Date.now();

    for (let i = 0; i < userCount; i++) {
      promises.push(this.simulateUser(sessionDuration, actions));
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    const totalActions = results.reduce((sum, r) => sum + r.totalActions, 0);
    const successfulActions = results.reduce((sum, r) => sum + r.successfulActions, 0);
    const avgActionsPerUser = totalActions / userCount;

    return {
      userCount,
      sessionDuration,
      totalActions,
      successfulActions,
      successRate: (successfulActions / totalActions) * 100,
      avgActionsPerUser,
      actionsPerSecond: totalActions / ((endTime - startTime) / 1000)
    };
  }

  /**
   * Simulate individual user session
   */
  async simulateUser(duration, actions) {
    const startTime = Date.now();
    let totalActions = 0;
    let successfulActions = 0;

    while (Date.now() - startTime < duration) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      totalActions++;

      try {
        const success = await this.performUserAction(action);
        if (success) successfulActions++;
      } catch (error) {
        // Action failed
      }

      // Random delay between actions (100-2000ms)
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 1900));
    }

    return { totalActions, successfulActions };
  }

  /**
   * Perform user action
   */
  async performUserAction(action) {
    switch (action) {
      case 'redirect':
        const response = await fetch(`${this.baseUrl}/r/test123`, { redirect: 'manual' });
        return response.status === 302;

      case 'api_call':
        const apiResponse = await fetch(`${this.baseUrl}/api/v1/health`);
        return apiResponse.ok;

      case 'create_link':
        const createResponse = await fetch(`${this.baseUrl}/api/v1/links`, {
          method: 'POST',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: 'https://example.com/test',
            fallback_urls: ['https://example.com/fallback']
          })
        });
        return createResponse.ok;

      case 'view_analytics':
        const analyticsResponse = await fetch(`${this.baseUrl}/api/v1/analytics/overview`, {
          headers: { 'X-API-Key': this.apiKey }
        });
        return analyticsResponse.ok;

      default:
        return false;
    }
  }

  /**
   * Test database performance under load
   */
  async testDatabaseLoad() {
    // This would require direct database access
    // For now, simulate through API calls that exercise database
    const concurrency = 20;
    const queriesPerWorker = 50;
    const promises = [];

    const startTime = Date.now();

    for (let i = 0; i < concurrency; i++) {
      promises.push(this.runDatabaseQueries(queriesPerWorker));
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    const flatResults = results.flat();
    const successful = flatResults.filter(r => r.success).length;
    const avgQueryTime = flatResults.reduce((sum, r) => sum + r.queryTime, 0) / flatResults.length;

    return {
      totalQueries: concurrency * queriesPerWorker,
      successful,
      successRate: (successful / (concurrency * queriesPerWorker)) * 100,
      avgQueryTime,
      queriesPerSecond: (concurrency * queriesPerWorker) / ((endTime - startTime) / 1000)
    };
  }

  /**
   * Run database-intensive queries
   */
  async runDatabaseQueries(count) {
    const results = [];
    for (let i = 0; i < count; i++) {
      const startTime = Date.now();
      try {
        // Analytics queries are database-intensive
        const response = await fetch(`${this.baseUrl}/api/v1/analytics/export?days=7&page=1&limit=100`, {
          headers: { 'X-API-Key': this.apiKey }
        });
        results.push({
          success: response.ok,
          queryTime: Date.now() - startTime
        });
      } catch (error) {
        results.push({
          success: false,
          queryTime: Date.now() - startTime
        });
      }
    }
    return results;
  }

  /**
   * Test rate limiting effectiveness
   */
  async testRateLimiting() {
    const rateLimitUrl = `${this.baseUrl}/r/test123`;
    const requestsToTriggerLimit = 150; // Should exceed 60/minute limit
    const results = [];

    const startTime = Date.now();

    // Send requests as fast as possible
    for (let i = 0; i < requestsToTriggerLimit; i++) {
      try {
        const response = await fetch(rateLimitUrl, { redirect: 'manual' });
        results.push({
          success: response.status !== 429,
          rateLimited: response.status === 429,
          status: response.status
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message
        });
      }
    }

    const rateLimitedCount = results.filter(r => r.rateLimited).length;
    const successfulCount = results.filter(r => r.success).length;

    return {
      totalRequests: requestsToTriggerLimit,
      rateLimitedRequests: rateLimitedCount,
      successfulRequests: successfulCount,
      rateLimitingEffective: rateLimitedCount > 0,
      rateLimitingPercentage: (rateLimitedCount / requestsToTriggerLimit) * 100
    };
  }

  /**
   * Test bot detection under load
   */
  async testBotDetectionLoad() {
    const testCases = [
      { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', expected: false },
      { userAgent: 'curl/7.68.0', expected: true },
      { userAgent: 'python-requests/2.25.1', expected: true },
      { userAgent: 'Googlebot/2.1', expected: true },
      { userAgent: '', expected: true }
    ];

    const results = [];

    for (const testCase of testCases) {
      const batchSize = 20;
      const promises = [];

      for (let i = 0; i < batchSize; i++) {
        promises.push(
          fetch(`${this.baseUrl}/r/test123`, {
            redirect: 'manual',
            headers: { 'User-Agent': testCase.userAgent }
          })
        );
      }

      const responses = await Promise.all(promises);
      const allSuccessful = responses.every(r => r.status === 302);

      results.push({
        userAgent: testCase.userAgent || 'empty',
        expected: testCase.expected,
        allRequestsHandled: allSuccessful,
        responseCount: responses.length
      });
    }

    return {
      testCases: results,
      allTestsPassed: results.every(r => r.allRequestsHandled)
    };
  }

  /**
   * Test analytics performance with large datasets
   */
  async testAnalyticsPerformance() {
    const analyticsEndpoints = [
      '/api/v1/analytics/overview',
      '/api/v1/analytics/export?days=30&page=1&limit=1000',
      '/api/v1/analytics/export?days=7&page=1&limit=5000'
    ];

    const results = {};

    for (const endpoint of analyticsEndpoints) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          headers: { 'X-API-Key': this.apiKey }
        });
        const responseTime = Date.now() - startTime;
        
        results[endpoint] = {
          success: response.ok,
          responseTime,
          status: response.status,
          withinSLA: responseTime < 5000 // 5 second SLA
        };
      } catch (error) {
        results[endpoint] = {
          success: false,
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * Stress test health check system
   */
  async testHealthCheckStress() {
    // Simulate health check system under load
    const concurrency = 10;
    const checksPerWorker = 30;
    const promises = [];

    const startTime = Date.now();

    for (let i = 0; i < concurrency; i++) {
      promises.push(this.runHealthChecks(checksPerWorker));
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    const flatResults = results.flat();
    const successful = flatResults.filter(r => r.success).length;
    const avgResponseTime = flatResults.reduce((sum, r) => sum + r.responseTime, 0) / flatResults.length;

    return {
      totalChecks: concurrency * checksPerWorker,
      successful,
      successRate: (successful / (concurrency * checksPerWorker)) * 100,
      avgResponseTime,
      checksPerSecond: (concurrency * checksPerWorker) / ((endTime - startTime) / 1000)
    };
  }

  /**
   * Run health check requests
   */
  async runHealthChecks(count) {
    const results = [];
    for (let i = 0; i < count; i++) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${this.baseUrl}/api/v1/health`);
        results.push({
          success: response.ok,
          responseTime: Date.now() - startTime,
          status: response.status
        });
      } catch (error) {
        results.push({
          success: false,
          responseTime: Date.now() - startTime,
          error: error.message
        });
      }
    }
    return results;
  }

  /**
   * Calculate percentile from array of values
   */
  calculatePercentile(values, percentile) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    console.log('\n📊 LOAD TESTING RESULTS');
    console.log('=======================');

    const report = {
      testDate: new Date().toISOString(),
      results: this.results,
      summary: this.generateSummary()
    };

    console.log(JSON.stringify(report, null, 2));

    // Check if system meets production requirements
    const productionReady = this.assessProductionReadiness();
    
    console.log('\n🎯 PRODUCTION READINESS ASSESSMENT');
    console.log('=====================================');
    console.log(`Overall Status: ${productionReady.status}`);
    console.log(`Recommendation: ${productionReady.recommendation}`);
    
    if (productionReady.issues.length > 0) {
      console.log('\n⚠️  Issues to Address:');
      productionReady.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    return report;
  }

  /**
   * Generate test summary
   */
  generateSummary() {
    const totalTests = Object.keys(this.results).length;
    const passedTests = Object.values(this.results).filter(r => r.success).length;
    const successRate = (passedTests / totalTests) * 100;

    return {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate
    };
  }

  /**
   * Assess production readiness based on test results
   */
  assessProductionReadiness() {
    const issues = [];
    let status = 'READY';

    // Check redirect performance
    const redirectTest = this.results['Redirect Performance'];
    if (redirectTest && redirectTest.success) {
      if (redirectTest.successRate < 99.5) {
        issues.push(`Redirect success rate too low: ${redirectTest.successRate}% (target: 99.5%)`);
        status = 'NOT_READY';
      }
      if (redirectTest.p95ResponseTime > 200) {
        issues.push(`P95 response time too high: ${redirectTest.p95ResponseTime}ms (target: <200ms)`);
      }
    }

    // Check rate limiting
    const rateLimitTest = this.results['Rate Limiting Validation'];
    if (rateLimitTest && rateLimitTest.success && !rateLimitTest.rateLimitingEffective) {
      issues.push('Rate limiting not working effectively');
      status = 'NOT_READY';
    }

    // Check overall test success rate
    const summary = this.generateSummary();
    if (summary.successRate < 80) {
      issues.push(`Overall test success rate too low: ${summary.successRate}%`);
      status = 'NOT_READY';
    }

    return {
      status,
      issues,
      recommendation: status === 'READY' 
        ? 'System is ready for production deployment'
        : 'Address identified issues before production deployment'
    };
  }
}

// Export for testing
export { LoadTester };

// CLI runner
if (typeof process !== 'undefined' && process.argv) {
  const baseUrl = process.argv[2] || 'http://localhost:8787';
  const apiKey = process.argv[3] || 'test-api-key';

  const tester = new LoadTester(baseUrl, apiKey);
  tester.runLoadTests().catch(console.error);
}