export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'Worker is running',
        env: {
          hasDB: !!env.DB,
          hasKV: !!env.LINKS,
          hasAnalytics: !!env.ANALYTICS,
          vars: {
            ENVIRONMENT: env.ENVIRONMENT,
            API_KEY_SALT: env.API_KEY_SALT ? 'set' : 'not set',
            HASH_SALT: env.HASH_SALT ? 'set' : 'not set'
          }
        }
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Test worker - use /test endpoint', { status: 200 });
  }
}