import { describe, it, expect } from 'vitest';

describe('Phase 2: Basic Worker Test', () => {
  it('should import worker without errors', async () => {
    try {
      const worker = await import('../src/index.js');
      expect(worker.default).toBeDefined();
      expect(typeof worker.default.fetch).toBe('function');
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  });

  it('should handle basic request', async () => {
    try {
      const worker = await import('../src/index.js');
      
      const request = new Request('https://example.com/health');
      const env = { 
        ENVIRONMENT: 'test',
        LINKS: {
          get: async () => null,
          put: async () => {},
          delete: async () => {}
        }
      };
      const ctx = {};
      
      const response = await worker.default.fetch(request, env, ctx);
      console.log('Response status:', response.status);
      const text = await response.text();
      console.log('Response text:', text);
      
      // Just verify we get a response
      expect(response).toBeDefined();
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  });
});