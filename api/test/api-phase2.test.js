import { describe, it, expect, beforeEach } from 'vitest';

// Mock implementations for testing
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

  async put(key, value, options = {}) {
    this.data.set(key, value);
  }

  async delete(key) {
    this.data.delete(key);
  }
}

class MockD1Database {
  constructor() {
    this.tables = {
      users: new Map(),
      links: new Map(),
      clicks: new Map(),
      plan_limits: new Map([
        ['free', { plan: 'free', links_limit: 100, api_requests_per_minute: 60 }],
        ['pro', { plan: 'pro', links_limit: 5000, api_requests_per_minute: 300 }]
      ])
    };
    this.nextId = 1;
  }

  prepare(query) {
    return {
      bind: (...params) => ({
        run: async () => this.executeQuery(query, params),
        first: async () => this.executeQuery(query, params, true),
        all: async () => ({ results: this.executeQuery(query, params, false, true) })
      })
    };
  }

  executeQuery(query, params = [], returnFirst = false, returnAll = false) {
    const q = query.toLowerCase().trim();
    
    if (q.includes('select') && q.includes('from users') && q.includes('where api_key')) {
      const apiKey = params[0];
      for (const [id, user] of this.tables.users) {
        if (user.api_key === apiKey) {
          return returnFirst ? user : [user];
        }
      }
      return returnFirst ? null : [];
    }
    
    if (q.includes('select') && q.includes('from users') && q.includes('where id')) {
      const userId = params[0];
      const user = this.tables.users.get(userId);
      return returnFirst ? user : user ? [user] : [];
    }
    
    if (q.includes('select') && q.includes('from plan_limits')) {
      const plan = params[0];
      const limits = this.tables.plan_limits.get(plan);
      return returnFirst ? limits : limits ? [limits] : [];
    }
    
    if (q.includes('select count') && q.includes('from links')) {
      const ownerId = params[0];
      let count = 0;
      for (const [slug, link] of this.tables.links) {
        if (link.owner_id === ownerId && link.status !== 'deleted') {
          count++;
        }
      }
      return returnFirst ? { count } : [{ count }];
    }
    
    if (q.includes('insert into links')) {
      const [slug, ownerId, createdAt, updatedAt, status] = params;
      this.tables.links.set(slug, {
        slug,
        owner_id: ownerId,
        created_at: createdAt,
        updated_at: updatedAt,
        status,
        clicks: 0
      });
      return { success: true };
    }
    
    if (q.includes('select') && q.includes('from links') && q.includes('where slug')) {
      const slug = params[0];
      const link = this.tables.links.get(slug);
      return returnFirst ? link : link ? [link] : [];
    }
    
    if (q.includes('select') && q.includes('from links') && q.includes('where owner_id')) {
      const ownerId = params[0];
      const links = [];
      for (const [slug, link] of this.tables.links) {
        if (link.owner_id === ownerId && link.status !== 'deleted') {
          links.push(link);
        }
      }
      
      if (returnAll) {
        return links.slice(0, params[1] || 20); // Apply limit
      }
      return returnFirst ? links[0] || null : links;
    }
    
    if (q.includes('update links') && q.includes('set updated_at')) {
      const [updatedAt, status, slug] = params;
      const link = this.tables.links.get(slug);
      if (link) {
        link.updated_at = updatedAt;
        link.status = status;
      }
      return { success: true };
    }
    
    if (q.includes('select count') && q.includes('total')) {
      return returnFirst ? { total: this.tables.links.size } : [{ total: this.tables.links.size }];
    }
    
    // Default response
    return returnFirst ? null : [];
  }
}

// Import the test worker (compatible with test environment)
const worker = await import('../src/index-test.js');

describe('Phase 2: Links API', () => {
  let mockEnv;
  let mockKV;
  let mockDB;

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    mockDB = new MockD1Database();
    
    mockEnv = {
      LINKS: mockKV,
      DB: mockDB,
      ENVIRONMENT: 'test'
    };

    // Add test user
    mockDB.tables.users.set('test-user-1', {
      id: 'test-user-1',
      email: 'test@example.com',
      api_key: 'dl_test123',
      plan: 'free',
      status: 'active',
      created_at: Date.now()
    });
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const request = new Request('https://example.com/api/v1/links', {
        method: 'GET'
      });
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.code).toBe('MISSING_API_KEY');
    });

    it('should reject requests with invalid API key', async () => {
      const request = new Request('https://example.com/api/v1/links', {
        method: 'GET',
        headers: { 'X-API-Key': 'invalid_key' }
      });
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.code).toBe('INVALID_API_KEY');
    });

    it('should accept valid API key', async () => {
      const request = new Request('https://example.com/api/v1/user/profile', {
        method: 'GET',
        headers: { 'X-API-Key': 'dl_test123' }
      });
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.email).toBe('test@example.com');
    });
  });

  describe('Link Creation', () => {
    it('should create a new link successfully', async () => {
      const request = new Request('https://example.com/api/v1/links', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'dl_test123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://example.com/product',
          fallback_urls: ['https://example.com/similar']
        })
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('slug');
      expect(data).toHaveProperty('short_url');
      expect(data.target_url).toBe('https://example.com/product');
      expect(data.fallback_urls).toEqual(['https://example.com/similar']);
    });

    it('should reject invalid URLs', async () => {
      const request = new Request('https://example.com/api/v1/links', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'dl_test123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'javascript:alert("xss")'
        })
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should reject HTTP URLs (require HTTPS)', async () => {
      const request = new Request('https://example.com/api/v1/links', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'dl_test123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'http://example.com/unsafe'
        })
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Link Management', () => {
    let testSlug;

    beforeEach(async () => {
      // Create a test link
      const linkData = {
        slug: 'test123',
        primary_url: 'https://example.com/test',
        active_url: 'https://example.com/test',
        fallback_urls: [],
        status: 'live',
        owner_id: 'test-user-1',
        created_at: Date.now(),
        updated_at: Date.now()
      };
      
      await mockKV.put('test123', JSON.stringify(linkData));
      mockDB.tables.links.set('test123', {
        slug: 'test123',
        owner_id: 'test-user-1',
        created_at: linkData.created_at,
        updated_at: linkData.updated_at,
        status: 'live',
        clicks: 5
      });
      
      testSlug = 'test123';
    });

    it('should get link details', async () => {
      const request = new Request(`https://example.com/api/v1/links/${testSlug}`, {
        method: 'GET',
        headers: { 'X-API-Key': 'dl_test123' }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.slug).toBe(testSlug);
      expect(data.primary_url).toBe('https://example.com/test');
      expect(data.clicks).toBe(5);
    });

    it('should deny access to other users\' links', async () => {
      // Add another user
      mockDB.tables.users.set('other-user', {
        id: 'other-user',
        email: 'other@example.com',
        api_key: 'dl_other123',
        plan: 'free',
        status: 'active'
      });

      const request = new Request(`https://example.com/api/v1/links/${testSlug}`, {
        method: 'GET',
        headers: { 'X-API-Key': 'dl_other123' }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should list user links with pagination', async () => {
      const request = new Request('https://example.com/api/v1/links?page=1&limit=10', {
        method: 'GET',
        headers: { 'X-API-Key': 'dl_test123' }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('links');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.links)).toBe(true);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });

    it('should update link successfully', async () => {
      const request = new Request(`https://example.com/api/v1/links/${testSlug}`, {
        method: 'PUT',
        headers: { 
          'X-API-Key': 'dl_test123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          primary_url: 'https://example.com/updated',
          status: 'paused'
        })
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.primary_url).toBe('https://example.com/updated');
      expect(data.status).toBe('paused');
    });

    it('should delete link successfully', async () => {
      const request = new Request(`https://example.com/api/v1/links/${testSlug}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': 'dl_test123' }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(204);
      
      // Verify link is removed from KV
      const kvData = await mockKV.get(testSlug);
      expect(kvData).toBeNull();
    });
  });

  describe('User Management', () => {
    it('should get user profile', async () => {
      const request = new Request('https://example.com/api/v1/user/profile', {
        method: 'GET',
        headers: { 'X-API-Key': 'dl_test123' }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.email).toBe('test@example.com');
      expect(data.plan).toBe('free');
      expect(data).toHaveProperty('id');
      expect(data).not.toHaveProperty('api_key'); // Should not expose API key
    });

    it('should get user statistics', async () => {
      const request = new Request('https://example.com/api/v1/user/stats', {
        method: 'GET',
        headers: { 'X-API-Key': 'dl_test123' }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('links');
      expect(data).toHaveProperty('clicks');
      expect(data.links).toHaveProperty('total');
      expect(data.clicks).toHaveProperty('total');
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const request = new Request('https://example.com/api/v1/user/profile', {
        method: 'GET',
        headers: { 'X-API-Key': 'dl_test123' }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in API responses', async () => {
      const request = new Request('https://example.com/api/v1/user/profile', {
        method: 'GET',
        headers: { 'X-API-Key': 'dl_test123' }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should handle CORS securely (no wildcard origin without specific origin)', async () => {
      const request = new Request('https://example.com/api/v1/user/profile', {
        method: 'GET',
        headers: { 'X-API-Key': 'dl_test123' }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      // Security improvement: no wildcard origin without specific allowed origin
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      // But other CORS headers should still be present
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });

    it('should handle OPTIONS preflight requests securely', async () => {
      const request = new Request('https://example.com/api/v1/links', {
        method: 'OPTIONS'
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
      // Security: no wildcard origin for OPTIONS without specific origin
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should allow specific origins in production when configured', async () => {
      const prodEnv = { 
        ...mockEnv, 
        ENVIRONMENT: 'production',
        ALLOWED_ORIGINS: 'https://app.example.com,https://admin.example.com'
      };
      
      const request = new Request('https://example.com/api/v1/user/profile', {
        method: 'GET',
        headers: { 
          'X-API-Key': 'dl_test123',
          'Origin': 'https://app.example.com'
        }
      });
      
      const response = await worker.default.fetch(request, prodEnv, {});
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should block unauthorized origins in production', async () => {
      const prodEnv = { 
        ...mockEnv, 
        ENVIRONMENT: 'production',
        ALLOWED_ORIGINS: 'https://app.example.com'
      };
      
      const request = new Request('https://example.com/api/v1/user/profile', {
        method: 'GET',
        headers: { 
          'X-API-Key': 'dl_test123',
          'Origin': 'https://malicious.com'
        }
      });
      
      const response = await worker.default.fetch(request, prodEnv, {});
      
      expect(response.status).toBe(200);
      // Security: unauthorized origin should not get CORS access
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });
  });

  describe('Integration with Phase 1 Redirects', () => {
    it('should allow redirects for API-created links', async () => {
      // Create link via API
      const createRequest = new Request('https://example.com/api/v1/links', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'dl_test123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://example.com/target'
        })
      });
      
      const createResponse = await worker.default.fetch(createRequest, mockEnv, {});
      expect(createResponse.status).toBe(201);
      
      const { slug } = await createResponse.json();
      
      // Test redirect
      const redirectRequest = new Request(`https://example.com/r/${slug}`);
      const redirectResponse = await worker.default.fetch(redirectRequest, mockEnv, {});
      
      expect(redirectResponse.status).toBe(302);
      expect(redirectResponse.headers.get('Location')).toBe('https://example.com/target');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const request = new Request('https://example.com/api/v1/links', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'dl_test123',
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_JSON');
    });

    it('should return 404 for non-existent endpoints', async () => {
      const request = new Request('https://example.com/api/v1/nonexistent', {
        method: 'GET',
        headers: { 'X-API-Key': 'dl_test123' }
      });
      
      const response = await worker.default.fetch(request, mockEnv, {});
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.code).toBe('NOT_FOUND');
    });
  });
});