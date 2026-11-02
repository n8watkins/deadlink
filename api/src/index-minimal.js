export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Basic health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Basic redirect test
    if (url.pathname.startsWith('/r/')) {
      const slug = url.pathname.substring(3);
      
      try {
        // Get link from KV
        const linkData = await env.LINKS.get(slug, 'json');
        
        if (!linkData) {
          return new Response('Link not found', { status: 404 });
        }
        
        // Simple redirect
        return Response.redirect(linkData.url || linkData.active_url, 302);
        
      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }
    
    // API endpoint test
    if (url.pathname === '/api/v1/links' && request.method === 'POST') {
      try {
        const data = await request.json();
        const slug = Math.random().toString(36).substring(2, 8);
        
        // Store in KV
        await env.LINKS.put(slug, JSON.stringify({
          url: data.url,
          active_url: data.url,
          created_at: Date.now()
        }));
        
        return new Response(JSON.stringify({
          success: true,
          slug: slug,
          short_url: `${url.origin}/r/${slug}`
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }
    
    return new Response('Dead Link Switchboard API - Minimal Version', { status: 200 });
  }
};