#!/usr/bin/env node

// Phase 4: Analytics Performance Testing
// Comprehensive performance test for analytics and bot detection

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const API_URL = process.env.API_URL || WORKER_URL;
const API_KEY = process.env.API_KEY || 'dl_test123';

const TEST_CONFIG = {
  duration: parseInt(process.env.TEST_DURATION || '30000'), // 30 seconds
  concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS || '50'),
  batchSize: parseInt(process.env.BATCH_SIZE || '10'),
  targetRPS: parseInt(process.env.TARGET_RPS || '100')
};

// Performance targets
const PERFORMANCE_TARGETS = {
  redirectP95: 100, // ms
  redirectP99: 200, // ms
  apiP95: 500, // ms
  successRate: 95, // %
  rps: 50,
  botDetectionRate: 80 // % of bots detected
};

class PerformanceTest {
  constructor() {
    this.results = {
      redirects: [],
      analytics: [],
      botDetection: [],
      errors: []
    };
    this.testSlug = null;
  }

  async run() {
    console.log('🚀 Starting Analytics Performance Test');
    console.log(`Target: ${WORKER_URL}`);
    console.log(`Duration: ${TEST_CONFIG.duration}ms`);
    console.log(`Concurrent Requests: ${TEST_CONFIG.concurrentRequests}`);
    console.log(`Target RPS: ${TEST_CONFIG.targetRPS}`);
    console.log('');

    try {
      // Setup test environment
      await this.setup();
      
      // Run performance tests
      await Promise.all([
        this.testRedirectPerformance(),
        this.testAnalyticsPerformance(),
        this.testBotDetectionAccuracy()
      ]);
      
      // Analyze and report results
      this.analyzeResults();
      
    } catch (error) {
      console.error('Test failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async setup() {
    console.log('📋 Setting up test environment...');
    
    // Create test link
    const response = await fetch(`${API_URL}/api/v1/links`, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://httpstat.us/200'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create test link: ${response.status}`);
    }

    const data = await response.json();
    this.testSlug = data.slug;
    console.log(`   ✅ Created test link: ${this.testSlug}`);
  }

  async testRedirectPerformance() {
    console.log('🔄 Testing redirect performance...');
    
    const startTime = Date.now();
    const promises = [];
    let requestCount = 0;

    // Different user agents for testing
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
      'curl/7.68.0', // Should be detected as bot
      'Googlebot/2.1' // Should be detected as bot
    ];

    while (Date.now() - startTime < TEST_CONFIG.duration) {
      for (let i = 0; i < TEST_CONFIG.batchSize && Date.now() - startTime < TEST_CONFIG.duration; i++) {
        const userAgent = userAgents[requestCount % userAgents.length];
        promises.push(this.makeRedirectRequest(userAgent, requestCount));
        requestCount++;
      }
      
      // Control request rate
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`   ⏳ Waiting for ${promises.length} redirect requests to complete...`);
    const results = await Promise.allSettled(promises);
    
    this.results.redirects = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(r => r !== null);

    console.log(`   ✅ Completed ${this.results.redirects.length} redirect tests`);
  }

  async makeRedirectRequest(userAgent, index) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${WORKER_URL}/r/${this.testSlug}`, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          'Accept': userAgent.includes('curl') ? '*/*' : 'text/html,application/xhtml+xml',
          'Accept-Language': userAgent.includes('curl') ? undefined : 'en-US,en;q=0.9'
        },
        redirect: 'manual'
      });

      const duration = Date.now() - startTime;
      const botScore = parseInt(response.headers.get('X-Bot-Score') || '0');
      const botCategory = response.headers.get('X-Bot-Category') || 'unknown';

      return {
        index,
        userAgent: userAgent.substring(0, 20),
        status: response.status,
        duration,
        botScore,
        botCategory,
        isBot: userAgent.includes('curl') || userAgent.includes('Googlebot'),
        timestamp: Date.now()
      };

    } catch (error) {
      this.results.errors.push({
        type: 'redirect',
        error: error.message,
        userAgent,
        timestamp: Date.now()
      });
      return null;
    }
  }

  async testAnalyticsPerformance() {
    console.log('📊 Testing analytics API performance...');
    
    // Wait a bit for some analytics data to accumulate
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const endpoints = [
      `/api/v1/analytics/link/${this.testSlug}`,
      '/api/v1/analytics/overview',
      '/api/v1/analytics/realtime',
      '/api/v1/analytics/bot-stats',
      '/api/v1/analytics/dashboard'
    ];

    const promises = [];
    
    // Test each endpoint multiple times
    for (let i = 0; i < 20; i++) {
      for (const endpoint of endpoints) {
        promises.push(this.makeAnalyticsRequest(endpoint, i));
      }
    }

    console.log(`   ⏳ Testing ${promises.length} analytics API requests...`);
    const results = await Promise.allSettled(promises);
    
    this.results.analytics = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(r => r !== null);

    console.log(`   ✅ Completed ${this.results.analytics.length} analytics API tests`);
  }

  async makeAnalyticsRequest(endpoint, index) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'X-API-Key': API_KEY
        }
      });

      const duration = Date.now() - startTime;
      
      // Try to parse response
      let dataSize = 0;
      try {
        const data = await response.json();
        dataSize = JSON.stringify(data).length;
      } catch {
        // Non-JSON response
      }

      return {
        endpoint,
        index,
        status: response.status,
        duration,
        dataSize,
        success: response.ok,
        timestamp: Date.now()
      };

    } catch (error) {
      this.results.errors.push({
        type: 'analytics',
        endpoint,
        error: error.message,
        timestamp: Date.now()
      });
      return null;
    }
  }

  async testBotDetectionAccuracy() {
    console.log('🤖 Testing bot detection accuracy...');
    
    const testCases = [
      // Known bots (should score high)
      { ua: 'Googlebot/2.1', expected: 'bot', minScore: 90 },
      { ua: 'facebookexternalhit/1.1', expected: 'bot', minScore: 90 },
      { ua: 'curl/7.68.0', expected: 'bot', minScore: 70 },
      { ua: 'python-requests/2.25.1', expected: 'bot', minScore: 70 },
      
      // Human browsers (should score low)
      { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', expected: 'human', maxScore: 40 },
      { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', expected: 'human', maxScore: 40 },
      { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15', expected: 'human', maxScore: 40 }
    ];

    const promises = testCases.map((testCase, index) => 
      this.testBotDetection(testCase, index)
    );

    const results = await Promise.all(promises);
    this.results.botDetection = results.filter(r => r !== null);

    console.log(`   ✅ Completed ${this.results.botDetection.length} bot detection tests`);
  }

  async testBotDetection(testCase, index) {
    try {
      const response = await fetch(`${WORKER_URL}/r/${this.testSlug}`, {
        method: 'GET',
        headers: {
          'User-Agent': testCase.ua,
          'Accept': testCase.expected === 'human' ? 'text/html,application/xhtml+xml' : undefined,
          'Accept-Language': testCase.expected === 'human' ? 'en-US,en;q=0.9' : undefined
        },
        redirect: 'manual'
      });

      const botScore = parseInt(response.headers.get('X-Bot-Score') || '0');
      const botCategory = response.headers.get('X-Bot-Category') || 'unknown';
      
      // Determine if detection was correct
      let correct = false;
      if (testCase.expected === 'bot') {
        correct = botScore >= (testCase.minScore || 50);
      } else {
        correct = botScore <= (testCase.maxScore || 50);
      }

      return {
        index,
        userAgent: testCase.ua.substring(0, 30),
        expected: testCase.expected,
        botScore,
        botCategory,
        correct,
        status: response.status
      };

    } catch (error) {
      this.results.errors.push({
        type: 'bot_detection',
        testCase,
        error: error.message,
        timestamp: Date.now()
      });
      return null;
    }
  }

  analyzeResults() {
    console.log('\n📊 Performance Analysis Results:');
    console.log('=====================================');

    this.analyzeRedirectPerformance();
    this.analyzeAnalyticsPerformance();
    this.analyzeBotDetectionAccuracy();
    this.analyzeErrors();
    this.showFinalSummary();
  }

  analyzeRedirectPerformance() {
    const redirects = this.results.redirects;
    if (redirects.length === 0) {
      console.log('❌ No redirect performance data');
      return;
    }

    const durations = redirects.map(r => r.duration).sort((a, b) => a - b);
    const successfulRedirects = redirects.filter(r => r.status === 302).length;
    const successRate = (successfulRedirects / redirects.length) * 100;

    const stats = {
      total: redirects.length,
      successRate: successRate.toFixed(1),
      avg: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1),
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
      max: Math.max(...durations),
      rps: (redirects.length / (TEST_CONFIG.duration / 1000)).toFixed(1)
    };

    console.log('\n🔄 Redirect Performance:');
    console.log(`   Total Requests: ${stats.total}`);
    console.log(`   Success Rate: ${stats.successRate}% ${this.getStatusIcon(stats.successRate, PERFORMANCE_TARGETS.successRate)}`);
    console.log(`   Average: ${stats.avg}ms`);
    console.log(`   P50: ${stats.p50}ms`);
    console.log(`   P95: ${stats.p95}ms ${this.getStatusIcon(stats.p95, PERFORMANCE_TARGETS.redirectP95, true)}`);
    console.log(`   P99: ${stats.p99}ms ${this.getStatusIcon(stats.p99, PERFORMANCE_TARGETS.redirectP99, true)}`);
    console.log(`   Max: ${stats.max}ms`);
    console.log(`   RPS: ${stats.rps} ${this.getStatusIcon(stats.rps, PERFORMANCE_TARGETS.rps)}`);
  }

  analyzeAnalyticsPerformance() {
    const analytics = this.results.analytics;
    if (analytics.length === 0) {
      console.log('❌ No analytics performance data');
      return;
    }

    const durations = analytics.map(r => r.duration).sort((a, b) => a - b);
    const successfulRequests = analytics.filter(r => r.success).length;
    const successRate = (successfulRequests / analytics.length) * 100;

    const stats = {
      total: analytics.length,
      successRate: successRate.toFixed(1),
      avg: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1),
      p95: durations[Math.floor(durations.length * 0.95)],
      maxDataSize: Math.max(...analytics.map(r => r.dataSize || 0))
    };

    console.log('\n📊 Analytics API Performance:');
    console.log(`   Total Requests: ${stats.total}`);
    console.log(`   Success Rate: ${stats.successRate}% ${this.getStatusIcon(stats.successRate, PERFORMANCE_TARGETS.successRate)}`);
    console.log(`   Average: ${stats.avg}ms`);
    console.log(`   P95: ${stats.p95}ms ${this.getStatusIcon(stats.p95, PERFORMANCE_TARGETS.apiP95, true)}`);
    console.log(`   Max Response Size: ${(stats.maxDataSize / 1024).toFixed(1)}KB`);

    // Breakdown by endpoint
    const endpointStats = {};
    analytics.forEach(r => {
      const endpoint = r.endpoint.split('?')[0]; // Remove query params
      if (!endpointStats[endpoint]) {
        endpointStats[endpoint] = { durations: [], count: 0 };
      }
      endpointStats[endpoint].durations.push(r.duration);
      endpointStats[endpoint].count++;
    });

    console.log('\n   📈 By Endpoint:');
    Object.entries(endpointStats).forEach(([endpoint, data]) => {
      const avgDuration = (data.durations.reduce((a, b) => a + b, 0) / data.durations.length).toFixed(1);
      console.log(`      ${endpoint}: ${avgDuration}ms avg (${data.count} requests)`);
    });
  }

  analyzeBotDetectionAccuracy() {
    const botTests = this.results.botDetection;
    if (botTests.length === 0) {
      console.log('❌ No bot detection data');
      return;
    }

    const correctDetections = botTests.filter(t => t.correct).length;
    const accuracy = (correctDetections / botTests.length) * 100;

    console.log('\n🤖 Bot Detection Accuracy:');
    console.log(`   Total Tests: ${botTests.length}`);
    console.log(`   Correct Detections: ${correctDetections}`);
    console.log(`   Accuracy: ${accuracy.toFixed(1)}% ${this.getStatusIcon(accuracy, PERFORMANCE_TARGETS.botDetectionRate)}`);

    // Breakdown by expected category
    const botTestsByCategory = botTests.reduce((acc, test) => {
      if (!acc[test.expected]) acc[test.expected] = [];
      acc[test.expected].push(test);
      return acc;
    }, {});

    Object.entries(botTestsByCategory).forEach(([category, tests]) => {
      const correct = tests.filter(t => t.correct).length;
      const rate = (correct / tests.length * 100).toFixed(1);
      console.log(`   ${category}: ${correct}/${tests.length} (${rate}%)`);
    });
  }

  analyzeErrors() {
    const errors = this.results.errors;
    if (errors.length === 0) {
      console.log('\n✅ No errors encountered');
      return;
    }

    console.log(`\n❌ Errors (${errors.length}):`);
    
    const errorsByType = errors.reduce((acc, error) => {
      if (!acc[error.type]) acc[error.type] = [];
      acc[error.type].push(error);
      return acc;
    }, {});

    Object.entries(errorsByType).forEach(([type, errs]) => {
      console.log(`   ${type}: ${errs.length} errors`);
      
      // Show sample errors
      errs.slice(0, 3).forEach(err => {
        console.log(`      - ${err.error}`);
      });
    });
  }

  showFinalSummary() {
    console.log('\n🎯 Performance Targets Summary:');
    console.log('===============================');

    const redirects = this.results.redirects;
    const analytics = this.results.analytics;
    const botTests = this.results.botDetection;

    if (redirects.length > 0) {
      const durations = redirects.map(r => r.duration).sort((a, b) => a - b);
      const successRate = (redirects.filter(r => r.status === 302).length / redirects.length) * 100;
      const p95 = durations[Math.floor(durations.length * 0.95)];
      const rps = redirects.length / (TEST_CONFIG.duration / 1000);

      console.log(`   P95 < ${PERFORMANCE_TARGETS.redirectP95}ms: ${p95 < PERFORMANCE_TARGETS.redirectP95 ? '✅' : '❌'} (${p95}ms)`);
      console.log(`   Success Rate > ${PERFORMANCE_TARGETS.successRate}%: ${successRate > PERFORMANCE_TARGETS.successRate ? '✅' : '❌'} (${successRate.toFixed(1)}%)`);
      console.log(`   RPS > ${PERFORMANCE_TARGETS.rps}: ${rps > PERFORMANCE_TARGETS.rps ? '✅' : '❌'} (${rps.toFixed(1)})`);
    }

    if (botTests.length > 0) {
      const accuracy = (botTests.filter(t => t.correct).length / botTests.length) * 100;
      console.log(`   Bot Detection > ${PERFORMANCE_TARGETS.botDetectionRate}%: ${accuracy > PERFORMANCE_TARGETS.botDetectionRate ? '✅' : '❌'} (${accuracy.toFixed(1)}%)`);
    }

    console.log('\n🏁 Test Complete!');
  }

  getStatusIcon(value, target, lowerIsBetter = false) {
    const passes = lowerIsBetter ? value <= target : value >= target;
    return passes ? '✅' : '❌';
  }

  async cleanup() {
    if (this.testSlug) {
      console.log('\n🧹 Cleaning up...');
      try {
        await fetch(`${API_URL}/api/v1/links/${this.testSlug}`, {
          method: 'DELETE',
          headers: {
            'X-API-Key': API_KEY
          }
        });
        console.log('   ✅ Test link deleted');
      } catch (error) {
        console.log('   ⚠️  Failed to delete test link:', error.message);
      }
    }
  }
}

// Run the performance test
if (require.main === module) {
  const test = new PerformanceTest();
  test.run().catch(console.error);
}

module.exports = PerformanceTest;