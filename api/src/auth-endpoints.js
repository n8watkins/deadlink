import { nanoid } from 'nanoid';

/**
 * Hash password using Web Crypto API
 */
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a secure random token
 */
function generateToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

/**
 * Sign up a new user
 */
export async function handleSignUp(request, env) {
  try {
    const { email, password, name } = await request.json();

    // Validate input
    if (!email || !password) {
      return new Response(JSON.stringify({ 
        error: 'Email and password are required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ 
        error: 'Password must be at least 8 characters' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return new Response(JSON.stringify({ 
        error: 'User already exists',
        code: 'USER_EXISTS'
      }), { 
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password, env.API_KEY_SALT);

    // Create user
    const userId = nanoid();
    const apiKey = 'dl_' + generateToken();
    
    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, name, api_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
    `).bind(userId, email, passwordHash, name || null, apiKey).run();

    // Create session
    const sessionToken = generateToken();
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

    await env.DB.prepare(`
      INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      userId, 
      sessionToken, 
      expiresAt,
      request.headers.get('CF-Connecting-IP') || 'unknown',
      request.headers.get('User-Agent') || 'unknown'
    ).run();

    return new Response(JSON.stringify({
      user: {
        id: userId,
        email,
        name: name || null,
        plan: 'free',
        emailVerified: false,
        apiKey
      },
      session: {
        token: sessionToken,
        expiresAt
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Signup error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Sign in an existing user
 */
export async function handleSignIn(request, env) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return new Response(JSON.stringify({ 
        error: 'Email and password are required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, name, plan, email_verified, api_key FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify password
    const passwordHash = await hashPassword(password, env.API_KEY_SALT);
    if (passwordHash !== user.password_hash) {
      return new Response(JSON.stringify({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create session
    const sessionToken = generateToken();
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

    await env.DB.prepare(`
      INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      user.id, 
      sessionToken, 
      expiresAt,
      request.headers.get('CF-Connecting-IP') || 'unknown',
      request.headers.get('User-Agent') || 'unknown'
    ).run();

    return new Response(JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        emailVerified: user.email_verified === 1,
        apiKey: user.api_key
      },
      session: {
        token: sessionToken,
        expiresAt
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Signin error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get current session
 */
export async function handleGetSession(request, env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ 
      error: 'No session token provided' 
    }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const session = await env.DB.prepare(`
      SELECT id, user_id, token, expires_at 
      FROM sessions 
      WHERE token = ? AND expires_at > unixepoch()
    `).bind(token).first();

    if (!session) {
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired session' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      id: session.id,
      userId: session.user_id,
      token: session.token,
      expiresAt: session.expires_at
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Session error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get current user
 */
export async function handleGetUser(request, env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ 
      error: 'No session token provided' 
    }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get session
    const session = await env.DB.prepare(`
      SELECT user_id 
      FROM sessions 
      WHERE token = ? AND expires_at > unixepoch()
    `).bind(token).first();

    if (!session) {
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired session' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user
    const user = await env.DB.prepare(`
      SELECT id, email, name, plan, email_verified, api_key, created_at
      FROM users 
      WHERE id = ?
    `).bind(session.user_id).first();

    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'User not found' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get usage stats
    const linkCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM links WHERE owner_id = ?
    `).bind(user.id).first();

    return new Response(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      emailVerified: user.email_verified === 1,
      apiKey: user.api_key,
      createdAt: user.created_at,
      linkCount: linkCount?.count || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get user error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Sign out (invalidate session)
 */
export async function handleSignOut(request, env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ 
      success: true 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Delete session
    await env.DB.prepare(
      'DELETE FROM sessions WHERE token = ?'
    ).bind(token).run();

    return new Response(JSON.stringify({ 
      success: true 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Signout error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}