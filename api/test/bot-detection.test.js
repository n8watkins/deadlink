import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeRequest, getBotCategory, shouldBlockBot } from '../src/bot-detection.js';

// Mock environment
const mockEnv = {
  LINKS: {
    get: vi.fn(),
    put: vi.fn()
  },
  DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        run: vi.fn(),
        all: vi.fn(),
        first: vi.fn()
      }))
    }))
  },
  BLOCK_BOTS: 'false',
  BOT_BLOCK_THRESHOLD: '90'
};

describe('Bot Detection System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.LINKS.get.mockResolvedValue('0'); // Default rate limit count
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bot User-Agent Detection', () => {
    const knownBots = [
      'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'YandexBot/3.0; +http://yandex.com/bots',
      'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Twitterbot/1.0',
      'LinkedInBot/1.0 (compatible; Mozilla/5.0; LinkedInBot/1.0)',
      'WhatsApp/2.16.11 A',
      'TelegramBot (like TwitterBot)',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
    ];

    const suspiciousTools = [
      'curl/7.68.0',
      'Wget/1.20.3 (linux-gnu)',
      'python-requests/2.25.1',
      'PostmanRuntime/7.26.8',
      'insomnia/2021.2.2',
      'Apache-HttpClient/4.5.13 (Java/11.0.11)',
      'okhttp/4.9.1',
      'Go-http-client/1.1'
    ];

    const humanBrowsers = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];

    knownBots.forEach(userAgent => {
      it(`should detect known bot: ${userAgent.substring(0, 30)}...`, async () => {
        const mockRequest = createMockRequest({
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        });

        const analytics = await analyzeRequest(mockRequest, mockEnv);
        
        expect(analytics.isBot).toBe(true);
        expect(analytics.botScore).toBeGreaterThan(90);
        expect(analytics.category).toBe('definite_bot');
      });
    });

    suspiciousTools.forEach(userAgent => {
      it(`should detect suspicious tool: ${userAgent.substring(0, 30)}...`, async () => {
        const mockRequest = createMockRequest({
          'User-Agent': userAgent
        });

        const analytics = await analyzeRequest(mockRequest, mockEnv);
        
        expect(analytics.isBot).toBe(true);
        expect(analytics.botScore).toBeGreaterThanOrEqual(75);
        expect(['definite_bot', 'likely_bot'].includes(analytics.category)).toBe(true);
      });
    });

    humanBrowsers.forEach(userAgent => {
      it(`should allow human browser: ${userAgent.substring(0, 40)}...`, async () => {
        const mockRequest = createMockRequest({
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate'
        });

        const analytics = await analyzeRequest(mockRequest, mockEnv);
        
        expect(analytics.isBot).toBe(false);
        expect(analytics.botScore).toBeLessThan(50);
        expect(analytics.category).toBe('human');
      });
    });
  });

  describe('Header Analysis', () => {
    it('should increase bot score for missing User-Agent', async () => {
      const mockRequest = createMockRequest({
        'Accept': 'text/html',
        'Accept-Language': 'en-US'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.botScore).toBeGreaterThanOrEqual(50); // Missing UA adds 50
    });

    it('should increase bot score for missing Accept-Language', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)',
        'Accept': 'text/html'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.botScore).toBeGreaterThanOrEqual(25); // Missing Accept-Language adds 25
    });

    it('should increase bot score for missing Accept header', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)',
        'Accept-Language': 'en-US'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.botScore).toBeGreaterThanOrEqual(25); // Missing Accept adds 25
    });

    it('should increase bot score for non-browser Accept header', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.botScore).toBeGreaterThanOrEqual(30); // Non-browser Accept adds 30
    });

    it('should detect very short User-Agent as suspicious', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Bot',
        'Accept': 'text/html',
        'Accept-Language': 'en-US'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.botScore).toBeGreaterThanOrEqual(20); // Short UA adds 20
    });
  });

  describe('Cloudflare Bot Management Integration', () => {
    it('should incorporate Cloudflare bot score', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)',
        'Accept': 'text/html',
        'Accept-Language': 'en-US'
      });
      
      // Mock Cloudflare data with high bot score
      mockRequest.cf = {
        botManagement: { score: 85 },
        country: 'US',
        city: 'San Francisco'
      };

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.cfBotScore).toBe(85);
      expect(analytics.botScore).toBeGreaterThanOrEqual(50); // CF bot score > 80 adds 50
    });
  });

  describe('Rate Limiting Detection', () => {
    it('should detect high request rate from same IP', async () => {
      // Mock high rate count
      mockEnv.LINKS.get.mockResolvedValue('70'); // 70 requests in current window
      
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)',
        'Accept': 'text/html',
        'Accept-Language': 'en-US',
        'CF-Connecting-IP': '192.168.1.1'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.botScore).toBeGreaterThanOrEqual(30); // High rate adds score
      expect(mockEnv.LINKS.put).toHaveBeenCalled(); // Rate counter updated
    });

    it('should block extremely high request rate', async () => {
      // Mock very high rate count
      mockEnv.LINKS.get.mockResolvedValue('150'); // 150 requests in current window
      
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)',
        'CF-Connecting-IP': '192.168.1.1'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.botScore).toBeGreaterThanOrEqual(50); // Very high rate
    });
  });

  describe('Bot Category Classification', () => {
    it('should classify high scores as definite bot', () => {
      expect(getBotCategory(95)).toBe('definite_bot');
      expect(getBotCategory(90)).toBe('definite_bot');
    });

    it('should classify medium scores as likely bot', () => {
      expect(getBotCategory(75)).toBe('likely_bot');
      expect(getBotCategory(50)).toBe('likely_bot');
    });

    it('should classify low scores as suspicious', () => {
      expect(getBotCategory(40)).toBe('suspicious');
      expect(getBotCategory(25)).toBe('suspicious');
    });

    it('should classify very low scores as human', () => {
      expect(getBotCategory(20)).toBe('human');
      expect(getBotCategory(0)).toBe('human');
    });
  });

  describe('Bot Blocking Logic', () => {
    it('should not block when BLOCK_BOTS is false', () => {
      mockEnv.BLOCK_BOTS = 'false';
      const analytics = { botScore: 95, isBot: true };
      
      expect(shouldBlockBot(analytics, mockEnv)).toBe(false);
    });

    it('should block high-scoring bots when enabled', () => {
      mockEnv.BLOCK_BOTS = 'true';
      mockEnv.BOT_BLOCK_THRESHOLD = '90';
      const analytics = { botScore: 95, isBot: true };
      
      expect(shouldBlockBot(analytics, mockEnv)).toBe(true);
    });

    it('should not block below threshold', () => {
      mockEnv.BLOCK_BOTS = 'true';
      mockEnv.BOT_BLOCK_THRESHOLD = '90';
      const analytics = { botScore: 85, isBot: true };
      
      expect(shouldBlockBot(analytics, mockEnv)).toBe(false);
    });

    it('should respect custom threshold', () => {
      mockEnv.BLOCK_BOTS = 'true';
      mockEnv.BOT_BLOCK_THRESHOLD = '50';
      const analytics = { botScore: 60, isBot: true };
      
      expect(shouldBlockBot(analytics, mockEnv)).toBe(true);
    });
  });

  describe('Whitelist Functionality', () => {
    it('should whitelist Google Web Light', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Linux; Android 4.2.1; en-us; Nexus 5 Build/JOP40D) AppleWebKit/535.19 (KHTML, like Gecko; googleweblight) Chrome/38.0.1025.166 Mobile Safari/535.19'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.botScore).toBe(0);
      expect(analytics.isBot).toBe(false);
      expect(analytics.category).toBe('human');
    });

    it('should whitelist preview bots', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0 preview'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.botScore).toBe(0);
      expect(analytics.isBot).toBe(false);
      expect(analytics.category).toBe('human');
    });
  });

  describe('Geographic Data Collection', () => {
    it('should collect Cloudflare geographic data', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)'
      });
      
      mockRequest.cf = {
        country: 'US',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
        asn: 13335
      };

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.country).toBe('US');
      expect(analytics.city).toBe('San Francisco');
      expect(analytics.timezone).toBe('America/Los_Angeles');
      expect(analytics.asn).toBe(13335);
    });

    it('should handle missing Cloudflare data gracefully', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.country).toBe('unknown');
      expect(analytics.city).toBe('unknown');
      expect(analytics.timezone).toBe('unknown');
      expect(analytics.asn).toBe(0);
    });
  });

  describe('Privacy Protection', () => {
    it('should hash IP addresses', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)',
        'CF-Connecting-IP': '192.168.1.100'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.ip).not.toBe('192.168.1.100'); // Should be hashed
      expect(analytics.ip).toBeDefined();
      expect(analytics.ip).not.toBe('unknown');
    });

    it('should handle missing IP gracefully', async () => {
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.ip).toBe('unknown');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rate limit storage errors gracefully', async () => {
      mockEnv.LINKS.get.mockRejectedValue(new Error('Storage error'));
      
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)',
        'CF-Connecting-IP': '192.168.1.1'
      });

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      // Should not throw error and should complete analysis
      expect(analytics).toBeDefined();
      expect(analytics.botScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing environment gracefully', async () => {
      const minimalEnv = {}; // No LINKS or DB
      
      const mockRequest = createMockRequest({
        'User-Agent': 'Mozilla/5.0 (Test Browser)'
      });

      const analytics = await analyzeRequest(mockRequest, minimalEnv);
      
      expect(analytics).toBeDefined();
      expect(analytics.botScore).toBeGreaterThanOrEqual(0);
    });

    it('should limit bot score to maximum of 100', async () => {
      // Create conditions that would score > 100
      const mockRequest = createMockRequest({
        'User-Agent': 'Googlebot/2.1', // +100
        // Missing Accept-Language: +25
        // Missing Accept: +25
      });
      
      mockRequest.cf = {
        botManagement: { score: 95 } // +50
      };

      const analytics = await analyzeRequest(mockRequest, mockEnv);
      
      expect(analytics.botScore).toBeLessThanOrEqual(100);
    });
  });
});

// Helper function to create mock request objects
function createMockRequest(headers = {}) {
  return {
    headers: {
      get: (name) => headers[name] || null
    },
    cf: {}
  };
}