import { describe, it, expect } from 'vitest';

describe('Basic Worker Tests', () => {
  it('should export a default object with fetch method', async () => {
    const worker = await import('../src/index.js');
    
    expect(worker.default).toBeDefined();
    expect(typeof worker.default.fetch).toBe('function');
  });

  it('should handle root path request', async () => {
    const worker = await import('../src/index.js');
    
    const request = new Request('https://example.com/');
    const env = { ENVIRONMENT: 'test' };
    const ctx = {};
    
    const response = await worker.default.fetch(request, env, ctx);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.message).toBe('Dead-Link Switchboard API');
    expect(data.version).toBe('1.0.0');
    expect(data.environment).toBe('test');
  });

  it('should handle health check', async () => {
    const worker = await import('../src/index.js');
    
    const request = new Request('https://example.com/health');
    const env = { ENVIRONMENT: 'test' };
    const ctx = {};
    
    const response = await worker.default.fetch(request, env, ctx);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.worker).toBe('dead-link-switchboard');
  });

  it('should return 404 for unknown paths', async () => {
    const worker = await import('../src/index.js');
    
    const request = new Request('https://example.com/unknown');
    const env = { ENVIRONMENT: 'test' };
    const ctx = {};
    
    const response = await worker.default.fetch(request, env, ctx);
    
    expect(response.status).toBe(404);
  });
});