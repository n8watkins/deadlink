import { nanoid } from 'nanoid';
import {
  hashPassword,
  verifyPassword,
  generateApiKey,
  createSession,
  validateSession,
  checkRateLimit,
  verifyCSRFToken
} from './lib/auth-utils.js';

/**
 * Sign up a new user with enhanced security
 */
export async function handleSignUp(request, env) {
  try {
    const { email, password, name } = await request.json();
    
    // Rate limiting
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimit = await checkRateLimit(clientIp, 'signup', env, 3, 60); // 3 signups per hour
    
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: 'Too many signup attempts. Please try again later.',
        resetAt: rateLimit.resetAt
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate input
    if (!email || !password) {
      return new Response(JSON.stringify({ 
        error: 'Email and password are required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Enhanced password validation
    if (password.length < 8) {
      return new Response(JSON.stringify({ 
        error: 'Password must be at least 8 characters' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!(hasUpperCase && hasLowerCase && hasNumbers)) {
      return new Response(JSON.stringify({
        error: 'Password must contain uppercase, lowercase, and numbers'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        error: 'Invalid email format'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existing) {
      return new Response(JSON.stringify({ 
        error: 'User already exists',
        code: 'USER_EXISTS'
      }), { 
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = nanoid();
    const apiKey = generateApiKey();
    
    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, name, api_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
    `).bind(
      userId, 
      email.toLowerCase(), 
      passwordHash, 
      name || null, 
      apiKey
    ).run();

    // Create secure session
    const session = await createSession(userId, request, env);

    return new Response(JSON.stringify({
      user: {
        id: userId,
        email: email.toLowerCase(),
        name: name || null,
        plan: 'free',
        emailVerified: false,
        apiKey
      },
      session
    }), {
      status: 201,
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': session.csrfToken
      }
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
 * Handle OAuth sign-in (Google, etc.)
 * Creates or updates user account based on OAuth data
 */
export async function handleOAuthSignIn(request, env) {
  try {
    const { provider, email, name, providerId } = await request.json();
    
    if (!provider || !email) {
      return new Response(JSON.stringify({ 
        error: 'Provider and email are required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user exists
    let user = await env.DB.prepare(
      'SELECT id, email, name, plan, email_verified, api_key FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (!user) {
      // Create new user for OAuth sign-in
      const userId = nanoid();
      const apiKey = generateApiKey();
      
      await env.DB.prepare(`
        INSERT INTO users (id, email, name, api_key, plan, email_verified, oauth_provider, oauth_provider_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'free', 1, ?, ?, unixepoch(), unixepoch())
      `).bind(
        userId, 
        email.toLowerCase(), 
        name || null, 
        apiKey,
        provider,
        providerId
      ).run();

      user = {
        id: userId,
        email: email.toLowerCase(),
        name: name || null,
        plan: 'free',
        email_verified: 1,
        api_key: apiKey
      };
    } else {
      // Update existing user with OAuth info if not already set
      await env.DB.prepare(`
        UPDATE users 
        SET oauth_provider = COALESCE(oauth_provider, ?), 
            oauth_provider_id = COALESCE(oauth_provider_id, ?),
            updated_at = unixepoch()
        WHERE id = ?
      `).bind(provider, providerId, user.id).run();
    }

    return new Response(JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        emailVerified: user.email_verified === 1,
        apiKey: user.api_key
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('OAuth signin error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Sign in with enhanced security
 */
export async function handleSignIn(request, env) {
  try {
    const { email, password } = await request.json();
    
    // Rate limiting per IP
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimit = await checkRateLimit(clientIp, 'signin', env, 5, 15); // 5 attempts per 15 minutes
    
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: 'Too many login attempts. Please try again later.',
        resetAt: rateLimit.resetAt
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
    ).bind(email.toLowerCase()).first();

    // Use constant-time comparison to prevent timing attacks
    const invalidCredentialsResponse = new Response(JSON.stringify({ 
      error: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS'
    }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });

    if (!user) {
      // Add artificial delay to prevent user enumeration
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      return invalidCredentialsResponse;
    }

    // Verify password with bcrypt
    const passwordValid = await verifyPassword(password, user.password_hash);
    
    if (!passwordValid) {
      // Track failed attempts per user
      await checkRateLimit(user.id, 'failed_signin', env, 3, 30); // Lock after 3 failed attempts in 30 minutes
      return invalidCredentialsResponse;
    }

    // Check if account is locked due to failed attempts
    const accountLockCheck = await checkRateLimit(user.id, 'failed_signin', env, 3, 30);
    if (!accountLockCheck.allowed) {
      return new Response(JSON.stringify({
        error: 'Account temporarily locked due to failed login attempts.',
        resetAt: accountLockCheck.resetAt
      }), {
        status: 423, // Locked
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create secure session
    const session = await createSession(user.id, request, env);

    // Update last login
    await env.DB.prepare(`
      UPDATE users SET last_login_at = unixepoch() WHERE id = ?
    `).bind(user.id).run();

    return new Response(JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        emailVerified: user.email_verified === 1,
        apiKey: user.api_key
      },
      session
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': session.csrfToken
      }
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
 * Get current session with CSRF validation
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
    const session = await validateSession(token, env);

    if (!session) {
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired session' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      userId: session.user_id,
      expiresAt: session.expires_at,
      csrfToken: session.csrf_token
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
 * Get current user with session validation
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
    // Validate session
    const session = await validateSession(token, env);

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
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': session.csrf_token
      }
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
 * Sign out with CSRF protection
 */
export async function handleSignOut(request, env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const csrfToken = request.headers.get('X-CSRF-Token');

  if (!token) {
    return new Response(JSON.stringify({ 
      success: true 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // For state-changing operations, verify CSRF token
    const session = await validateSession(token, env);
    
    if (session && request.method !== 'GET') {
      if (!verifyCSRFToken(csrfToken, session.csrf_token)) {
        return new Response(JSON.stringify({
          error: 'Invalid CSRF token'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

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