export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
    };
    
    // Handle OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    
    // Helper to create JSON response
    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    };
    
    try {
      // Health check
      if (path === '/health') {
        return jsonResponse({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
      }
      
      // Sign up
      if (path === '/api/auth/signup' && request.method === 'POST') {
        const { email, password, name } = await request.json();
        
        if (!email || !password) {
          return jsonResponse({ error: 'Email and password required' }, 400);
        }
        
        // Check if user exists
        const existing = await env.DB.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(email).first();
        
        if (existing) {
          return jsonResponse({ error: 'User already exists' }, 409);
        }
        
        // Hash password (simple for now)
        const encoder = new TextEncoder();
        const data = encoder.encode(password + env.API_KEY_SALT);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const passwordHash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        // Create user
        const userId = crypto.randomUUID();
        const apiKey = 'dl_' + crypto.randomUUID().replace(/-/g, '');
        
        await env.DB.prepare(`
          INSERT INTO users (id, email, password_hash, name, api_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
        `).bind(userId, email, passwordHash, name || null, apiKey).run();
        
        // Create session
        const sessionToken = crypto.randomUUID().replace(/-/g, '');
        const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
        
        await env.DB.prepare(`
          INSERT INTO sessions (user_id, token, expires_at)
          VALUES (?, ?, ?)
        `).bind(userId, sessionToken, expiresAt).run();
        
        return jsonResponse({
          user: { id: userId, email, name, apiKey },
          session: { token: sessionToken, expiresAt }
        }, 201);
      }
      
      // Sign in
      if (path === '/api/auth/signin' && request.method === 'POST') {
        const { email, password } = await request.json();
        
        if (!email || !password) {
          return jsonResponse({ error: 'Email and password required' }, 400);
        }
        
        // Get user
        const user = await env.DB.prepare(
          'SELECT * FROM users WHERE email = ?'
        ).bind(email).first();
        
        if (!user) {
          return jsonResponse({ error: 'Invalid credentials' }, 401);
        }
        
        // Verify password
        const encoder = new TextEncoder();
        const data = encoder.encode(password + env.API_KEY_SALT);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const passwordHash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        if (passwordHash !== user.password_hash) {
          return jsonResponse({ error: 'Invalid credentials' }, 401);
        }
        
        // Create session
        const sessionToken = crypto.randomUUID().replace(/-/g, '');
        const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
        
        await env.DB.prepare(`
          INSERT INTO sessions (user_id, token, expires_at)
          VALUES (?, ?, ?)
        `).bind(user.id, sessionToken, expiresAt).run();
        
        return jsonResponse({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            apiKey: user.api_key
          },
          session: { token: sessionToken, expiresAt }
        });
      }
      
      // Get user
      if (path === '/api/auth/user' && request.method === 'GET') {
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        // Get session
        const session = await env.DB.prepare(
          'SELECT user_id FROM sessions WHERE token = ? AND expires_at > unixepoch()'
        ).bind(token).first();
        
        if (!session) {
          return jsonResponse({ error: 'Invalid session' }, 401);
        }
        
        // Get user
        const user = await env.DB.prepare(
          'SELECT id, email, name, plan, api_key FROM users WHERE id = ?'
        ).bind(session.user_id).first();
        
        if (!user) {
          return jsonResponse({ error: 'User not found' }, 404);
        }
        
        return jsonResponse({
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan || 'free',
          apiKey: user.api_key
        });
      }
      
      // Create link
      if (path === '/api/v1/links' && request.method === 'POST') {
        const data = await request.json();
        const slug = Math.random().toString(36).substring(2, 8);
        
        await env.LINKS.put(slug, JSON.stringify({
          url: data.url,
          active_url: data.url,
          created_at: Date.now()
        }));
        
        return jsonResponse({
          success: true,
          slug,
          short_url: `${url.origin}/r/${slug}`
        });
      }
      
      // Redirect
      if (path.startsWith('/r/')) {
        const slug = path.substring(3);
        const linkData = await env.LINKS.get(slug, 'json');
        
        if (!linkData) {
          return new Response('Link not found', { status: 404, headers: corsHeaders });
        }
        
        return Response.redirect(linkData.active_url || linkData.url, 302);
      }
      
      return jsonResponse({ error: 'Not found' }, 404);
      
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ 
        error: 'Internal server error',
        message: error.message 
      }, 500);
    }
  }
};