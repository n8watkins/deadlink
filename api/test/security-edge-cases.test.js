import { describe, it, expect, beforeEach } from 'vitest';

// Mock KV store for testing
class MockKVNamespace {
  constructor() {
    this.data = new Map();
  }

  async get(key, type = 'text') {
    const value = this.data.get(key);
    if (!value) return null;
    
    if (type === 'json') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  }

  async put(key, value) {
    this.data.set(key, value);
  }
}

// Import the worker
const worker = await import('../src/index.js');

describe('Security Edge Cases', () => {
  let mockEnv;
  let mockKV;

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    mockEnv = {
      LINKS: mockKV,
      ENVIRONMENT: 'test',
      FALLBACK_404_URL: 'https://example.com/404',
      RATE_LIMIT: '5' // Low limit for testing
    };
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await mockKV.put('rate-test', JSON.stringify({
        active_url: 'https://example.com/target',
        status: 'live'
      }));
    });

    it('should allow requests under rate limit', async () => {
      // First few requests should work
      for (let i = 0; i < 3; i++) {
        const request = new Request('https://example.com/r/rate-test', {
          headers: { 'CF-Connecting-IP': '1.2.3.4' }
        });
        const response = await worker.default.fetch(request, mockEnv, {});
        expect(response.status).toBe(302);
      }
    });

    it('should block requests over rate limit', async () => {
      // Make requests up to the limit
      for (let i = 0; i < 5; i++) {
        const request = new Request('https://example.com/r/rate-test', {
          headers: { 'CF-Connecting-IP': '1.2.3.5' }
        });
        await worker.default.fetch(request, mockEnv, {});
      }

      // Next request should be rate limited
      const request = new Request('https://example.com/r/rate-test', {
        headers: { 'CF-Connecting-IP': '1.2.3.5' }
      });
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(429);
      expect(await response.text()).toBe('Rate Limit Exceeded');
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('should not rate limit health checks', async () => {
      // Make many health check requests
      for (let i = 0; i < 10; i++) {
        const request = new Request('https://example.com/health');
        const response = await worker.default.fetch(request, mockEnv, {});
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Advanced URL Validation', () => {
    it('should block data URLs', async () => {
      await mockKV.put('data-url', JSON.stringify({
        active_url: 'data:text/html,<script>alert("xss")</script>',
        status: 'live'
      }));

      const request = new Request('https://example.com/r/data-url');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/404');
    });

    it('should handle malformed URLs gracefully', async () => {
      await mockKV.put('malformed-url', JSON.stringify({
        active_url: 'not-a-valid-url',
        status: 'live'
      }));

      const request = new Request('https://example.com/r/malformed-url');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/404');
    });

    it('should handle URLs with suspicious patterns', async () => {
      await mockKV.put('suspicious-url', JSON.stringify({
        active_url: 'https://example.com/<script>alert("xss")</script>',
        status: 'live'
      }));

      const request = new Request('https://example.com/r/suspicious-url');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/404');
    });
  });

  describe('Environment-specific Behavior', () => {
    it('should use different logging levels for production vs development', async () => {
      await mockKV.put('log-test', JSON.stringify({
        active_url: 'https://example.com/test',
        status: 'live'
      }));

      const prodEnv = { ...mockEnv, ENVIRONMENT: 'production' };
      const request = new Request('https://example.com/r/log-test');
      
      // Should not throw errors in either environment
      const response = await worker.default.fetch(request, prodEnv, {});
      expect(response.status).toBe(302);
    });

    it('should handle missing environment variables gracefully', async () => {
      const minimalEnv = {
        LINKS: mockKV
        // Missing other env vars
      };

      await mockKV.put('env-test', JSON.stringify({
        active_url: 'https://example.com/test',
        status: 'live'
      }));

      const request = new Request('https://example.com/r/env-test');
      const response = await worker.default.fetch(request, minimalEnv, {});
      
      expect(response.status).toBe(302);
    });
  });

  describe('Header Security', () => {
    it('should include all required security headers', async () => {
      const request = new Request('https://example.com/health');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should not leak sensitive information in headers', async () => {
      const request = new Request('https://example.com/health');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      // Should not expose sensitive system information
      expect(response.headers.get('Server')).toBeNull();
      expect(response.headers.get('X-Powered-By')).toBeNull();
    });
  });
});