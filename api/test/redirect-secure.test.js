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

  async delete(key) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }
}

// Import the worker
const worker = await import('../src/index-test.js');

describe('Secure Redirect Worker', () => {
  let mockEnv;
  let mockKV;

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    mockEnv = {
      LINKS: mockKV,
      ENVIRONMENT: 'test',
      FALLBACK_404_URL: 'https://example.com/404'
    };
  });

  describe('Security: URL Validation', () => {
    beforeEach(async () => {
      // Add test data with various URL types
      await mockKV.put('valid-https', JSON.stringify({
        slug: 'valid-https',
        active_url: 'https://example.com/safe',
        status: 'live'
      }));
      
      await mockKV.put('invalid-http', JSON.stringify({
        slug: 'invalid-http',
        active_url: 'http://example.com/unsafe',
        status: 'live'
      }));
      
      await mockKV.put('malicious-js', JSON.stringify({
        slug: 'malicious-js',
        active_url: 'javascript:alert("xss")',
        status: 'live'
      }));
      
      await mockKV.put('localhost-attack', JSON.stringify({
        slug: 'localhost-attack',
        active_url: 'https://localhost:3000/admin',
        status: 'live'
      }));
      
      await mockKV.put('private-ip', JSON.stringify({
        slug: 'private-ip',
        active_url: 'https://192.168.1.1/router',
        status: 'live'
      }));
    });

    it('should allow valid HTTPS URLs', async () => {
      const request = new Request('https://example.com/r/valid-https');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/safe');
    });

    it('should block HTTP URLs (require HTTPS)', async () => {
      const request = new Request('https://example.com/r/invalid-http');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/404');
    });

    it('should block javascript: URLs', async () => {
      const request = new Request('https://example.com/r/malicious-js');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/404');
    });

    it('should block localhost URLs', async () => {
      const request = new Request('https://example.com/r/localhost-attack');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/404');
    });

    it('should block private IP addresses', async () => {
      const request = new Request('https://example.com/r/private-ip');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/404');
    });
  });

  describe('Security: Slug Validation', () => {
    it('should reject slugs with special characters', async () => {
      const request = new Request('https://example.com/r/test<script>');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid Request');
    });

    it('should reject slugs with directory traversal', async () => {
      // The URL constructor automatically decodes, so .. becomes invalid due to regex
      const request = new Request('https://example.com/r/test..test');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(400);
    });

    it('should reject reserved words', async () => {
      const request = new Request('https://example.com/r/admin');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(400);
    });

    it('should reject overly long slugs', async () => {
      const longSlug = 'a'.repeat(101);
      const request = new Request(`https://example.com/r/${longSlug}`);
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(400);
    });

    it('should accept valid alphanumeric slugs', async () => {
      await mockKV.put('valid123', JSON.stringify({
        active_url: 'https://example.com/test',
        status: 'live'
      }));
      
      const request = new Request('https://example.com/r/valid123');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
    });
  });

  describe('Core Functionality', () => {
    beforeEach(async () => {
      await mockKV.put('active-link', JSON.stringify({
        slug: 'active-link',
        active_url: 'https://example.com/target',
        status: 'live',
        created_at: Date.now()
      }));
      
      await mockKV.put('disabled-link', JSON.stringify({
        slug: 'disabled-link',
        active_url: 'https://example.com/disabled',
        status: 'disabled',
        created_at: Date.now()
      }));
    });

    it('should successfully redirect active links', async () => {
      const request = new Request('https://example.com/r/active-link');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/target');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(response.headers.get('x-response-time')).toMatch(/^\d+ms$/);
      expect(response.headers.get('x-kv-time')).toMatch(/^\d+ms$/);
    });

    it('should return 410 for disabled links', async () => {
      const request = new Request('https://example.com/r/disabled-link');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(410);
      expect(await response.text()).toBe('Link Disabled');
    });

    it('should redirect to 404 page for non-existent links', async () => {
      const request = new Request('https://example.com/r/nonexistent');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/404');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for invalid route structure', async () => {
      const request = new Request('https://example.com/invalid');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(404);
    });

    it('should return 404 for empty slug', async () => {
      const request = new Request('https://example.com/r/');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(404);
    });

    it('should handle KV unavailability gracefully', async () => {
      const envWithoutKV = { ...mockEnv, LINKS: null };
      
      const request = new Request('https://example.com/r/test123');
      const response = await worker.default.fetch(request, envWithoutKV, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/404');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in API responses', async () => {
      const request = new Request('https://example.com/');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should not include CORS headers for unauthorized origins', async () => {
      const request = new Request('https://example.com/', {
        headers: { 'Origin': 'https://malicious.com' }
      });
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should include CORS headers for localhost in development', async () => {
      const devEnv = { ...mockEnv, ENVIRONMENT: 'development' };
      const request = new Request('https://example.com/', {
        headers: { 'Origin': 'http://localhost:3000' }
      });
      const response = await worker.default.fetch(request, devEnv, {});
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });
  });

  describe('Performance Headers', () => {
    beforeEach(async () => {
      await mockKV.put('perf-test', JSON.stringify({
        active_url: 'https://example.com/perf',
        status: 'live'
      }));
    });

    it('should include performance timing headers', async () => {
      const request = new Request('https://example.com/r/perf-test');
      const response = await worker.default.fetch(request, mockEnv, {});
      
      const responseTime = response.headers.get('x-response-time');
      const kvTime = response.headers.get('x-kv-time');
      
      expect(responseTime).toMatch(/^\d+ms$/);
      expect(kvTime).toMatch(/^\d+ms$/);
      
      // Response time should be reasonable
      const responseMs = parseInt(responseTime.replace('ms', ''));
      expect(responseMs).toBeLessThan(1000);
    });
  });

  describe('Domain Allowlist', () => {
    it('should respect ALLOWED_DOMAINS configuration', async () => {
      const restrictiveEnv = {
        ...mockEnv,
        ALLOWED_DOMAINS: 'example.com,safe-site.com'
      };
      
      await mockKV.put('allowed-domain', JSON.stringify({
        active_url: 'https://example.com/allowed',
        status: 'live'
      }));
      
      await mockKV.put('blocked-domain', JSON.stringify({
        active_url: 'https://malicious.com/blocked',
        status: 'live'
      }));
      
      // Allowed domain should work
      let request = new Request('https://example.com/r/allowed-domain');
      let response = await worker.default.fetch(request, restrictiveEnv, {});
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/allowed');
      
      // Blocked domain should redirect to 404
      request = new Request('https://example.com/r/blocked-domain');
      response = await worker.default.fetch(request, restrictiveEnv, {});
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/404');
    });
  });
});