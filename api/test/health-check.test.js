import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Health Check System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL Health Checking', () => {
    it('should detect live URLs (200 status)', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        ok: true
      });

      // Import checkUrl function (we'll need to export it from health-check.js)
      const { checkUrl } = await import('../src/health-check-test-utils.js');
      
      const result = await checkUrl('https://example.com/live', { timeout: 1000, maxRetries: 1 });
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/live', expect.objectContaining({
        method: 'HEAD'
      }));
    });

    it('should detect dead URLs (404 status)', async () => {
      mockFetch.mockResolvedValue({
        status: 404,
        ok: false
      });

      const { checkUrl } = await import('../src/health-check-test-utils.js');
      
      const result = await checkUrl('https://example.com/404', { timeout: 1000, maxRetries: 1 });
      expect(result).toBe(false);
    });

    it('should detect dead URLs (410 status)', async () => {
      mockFetch.mockResolvedValue({
        status: 410,
        ok: false
      });

      const { checkUrl } = await import('../src/health-check-test-utils.js');
      
      const result = await checkUrl('https://example.com/gone', { timeout: 1000, maxRetries: 1 });
      expect(result).toBe(false);
    });

    it('should handle redirects as live (302 status)', async () => {
      mockFetch.mockResolvedValue({
        status: 302,
        ok: true
      });

      const { checkUrl } = await import('../src/health-check-test-utils.js');
      
      const result = await checkUrl('https://example.com/redirect', { timeout: 1000, maxRetries: 1 });
      expect(result).toBe(true);
    });

    it('should retry on server errors (500 status)', async () => {
      mockFetch
        .mockResolvedValueOnce({ status: 500, ok: false })
        .mockResolvedValueOnce({ status: 200, ok: true });

      const { checkUrl } = await import('../src/health-check-test-utils.js');
      
      const result = await checkUrl('https://example.com/retry', { timeout: 1000, maxRetries: 2 });
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { checkUrl } = await import('../src/health-check-test-utils.js');
      
      const result = await checkUrl('https://example.com/error', { timeout: 1000, maxRetries: 1 });
      expect(result).toBe(false);
    });

    it('should handle timeouts via AbortError', async () => {
      // Mock fetch to throw AbortError after a delay
      mockFetch.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const error = new Error('This operation was aborted');
            error.name = 'AbortError';
            reject(error);
          }, 60);
        });
      });

      const { checkUrl } = await import('../src/health-check-test-utils.js');
      
      const result = await checkUrl('https://example.com/timeout', { timeout: 50, maxRetries: 1 });
      expect(result).toBe(false);
    });
  });

  describe('Failover Logic', () => {
    let mockEnv;

    beforeEach(() => {
      mockEnv = {
        LINKS: {
          get: vi.fn(),
          put: vi.fn()
        },
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              run: vi.fn()
            }))
          }))
        }
      };
    });

    it('should switch to fallback when primary URL is dead', async () => {
      // Mock primary URL as dead, fallback as alive
      mockFetch
        .mockResolvedValueOnce({ status: 404, ok: false }) // Primary URL
        .mockResolvedValueOnce({ status: 200, ok: true });  // Fallback URL

      const linkData = {
        slug: 'test123',
        primary_url: 'https://example.com/dead',
        active_url: 'https://example.com/dead',
        fallback_urls: ['https://example.com/alive'],
        status: 'live',
        last_checked: Date.now() - 7200000 // 2 hours ago
      };

      mockEnv.LINKS.get.mockResolvedValue(linkData);

      const { checkLinkHealth } = await import('../src/health-check-test-utils.js');
      
      await checkLinkHealth('test123', mockEnv, { timeout: 1000, maxRetries: 1 });

      // Verify that the link was updated
      expect(mockEnv.LINKS.put).toHaveBeenCalledWith('test123', expect.stringContaining('fallback_1'));
      
      // Verify status change was logged
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO link_status_changes')
      );
    });

    it('should mark as dead when all URLs fail', async () => {
      // Mock all URLs as dead
      mockFetch.mockResolvedValue({ status: 404, ok: false });

      const linkData = {
        slug: 'test456',
        primary_url: 'https://example.com/dead1',
        active_url: 'https://example.com/dead1',
        fallback_urls: ['https://example.com/dead2', 'https://example.com/dead3'],
        status: 'live',
        last_checked: Date.now() - 7200000
      };

      mockEnv.LINKS.get.mockResolvedValue(linkData);

      const { checkLinkHealth } = await import('../src/health-check-test-utils.js');
      
      await checkLinkHealth('test456', mockEnv, { timeout: 1000, maxRetries: 1 });

      // Verify that the link was marked as dead
      expect(mockEnv.LINKS.put).toHaveBeenCalledWith('test456', expect.stringContaining('"status":"dead"'));
    });

    it('should recover primary URL when it comes back online', async () => {
      // Mock primary URL as alive
      mockFetch.mockResolvedValue({ status: 200, ok: true });

      const linkData = {
        slug: 'test789',
        primary_url: 'https://example.com/recovered',
        active_url: 'https://example.com/fallback',
        fallback_urls: ['https://example.com/fallback'],
        status: 'fallback_1',
        last_checked: Date.now() - 7200000
      };

      mockEnv.LINKS.get.mockResolvedValue(linkData);

      const { checkLinkHealth } = await import('../src/health-check-test-utils.js');
      
      await checkLinkHealth('test789', mockEnv, { timeout: 1000, maxRetries: 1 });

      // Verify that the link was restored to primary
      expect(mockEnv.LINKS.put).toHaveBeenCalledWith('test789', expect.stringContaining('"status":"live"'));
      expect(mockEnv.LINKS.put).toHaveBeenCalledWith('test789', expect.stringContaining('https://example.com/recovered'));
    });

    it('should skip recently checked links', async () => {
      const linkData = {
        slug: 'recent123',
        primary_url: 'https://example.com/recent',
        active_url: 'https://example.com/recent',
        status: 'live',
        last_checked: Date.now() - 1800000 // 30 minutes ago (< 1 hour)
      };

      mockEnv.LINKS.get.mockResolvedValue(linkData);

      const { checkLinkHealth } = await import('../src/health-check-test-utils.js');
      
      await checkLinkHealth('recent123', mockEnv, { timeout: 1000, maxRetries: 1 });

      // Should not make any HTTP requests
      expect(mockFetch).not.toHaveBeenCalled();
      
      // Should still update last_checked timestamp
      expect(mockEnv.LINKS.put).toHaveBeenCalledWith('recent123', expect.stringContaining('"last_checked"'));
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple links in parallel', async () => {
      const mockEnv = {
        LINKS: {
          list: vi.fn().mockResolvedValue({
            keys: [
              { name: 'link1' },
              { name: 'link2' },
              { name: 'link3' }
            ],
            list_complete: true,
            cursor: null
          }),
          get: vi.fn(),
          put: vi.fn()
        },
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              run: vi.fn()
            }))
          }))
        }
      };

      const mockCtx = {
        waitUntil: vi.fn()
      };

      const { processBatchHealthChecks } = await import('../src/health-check-test-utils.js');
      
      await processBatchHealthChecks(mockEnv, mockCtx, { batchSize: 10 });

      // Verify that all links were queued for checking
      expect(mockCtx.waitUntil).toHaveBeenCalledTimes(3);
      
      // Verify batch stats were recorded
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO health_check_runs')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle KV errors gracefully', async () => {
      const mockEnv = {
        LINKS: {
          get: vi.fn().mockRejectedValue(new Error('KV error'))
        }
      };

      const { checkLinkHealth } = await import('../src/health-check-test-utils.js');
      
      // Should not throw
      await expect(checkLinkHealth('error-slug', mockEnv)).resolves.toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      const mockEnv = {
        LINKS: {
          get: vi.fn().mockResolvedValue({
            slug: 'db-error',
            active_url: 'https://example.com',
            status: 'live',
            last_checked: Date.now() - 7200000
          }),
          put: vi.fn()
        },
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              run: vi.fn().mockRejectedValue(new Error('DB error'))
            }))
          }))
        }
      };

      mockFetch.mockResolvedValue({ status: 200, ok: true });

      const { checkLinkHealth } = await import('../src/health-check-test-utils.js');
      
      // Should still update KV even if DB fails
      await checkLinkHealth('db-error', mockEnv);
      expect(mockEnv.LINKS.put).toHaveBeenCalled();
    });
  });
});