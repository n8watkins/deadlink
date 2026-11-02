/**
 * GDPR Compliance Features
 * Data export, deletion, and privacy management
 */

import { validateSession } from './lib/auth-utils.js';
import { AppError, ErrorCategory } from './error-logger.js';

/**
 * Export all user data for GDPR compliance
 */
export async function exportUserData(userId, env) {
  const userData = {};
  
  // Get user profile
  userData.profile = await env.DB.prepare(`
    SELECT id, email, name, plan, email_verified, created_at, last_login_at
    FROM users WHERE id = ?
  `).bind(userId).first();
  
  // Get all links
  userData.links = await env.DB.prepare(`
    SELECT slug, primary_url, clicks, status, created_at, updated_at
    FROM links WHERE owner_id = ?
  `).bind(userId).all();
  
  // Get click analytics
  userData.clickAnalytics = await env.DB.prepare(`
    SELECT c.* 
    FROM clicks c
    JOIN links l ON c.slug = l.slug
    WHERE l.owner_id = ?
    ORDER BY c.clicked_at DESC
    LIMIT 10000
  `).bind(userId).all();
  
  // Get sessions
  userData.sessions = await env.DB.prepare(`
    SELECT token, ip_address, user_agent, created_at, last_activity
    FROM sessions WHERE user_id = ?
  `).bind(userId).all();
  
  // Get security events
  userData.securityEvents = await env.DB.prepare(`
    SELECT event_type, event_data, ip_address, created_at
    FROM security_audit_log WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(userId).all();
  
  return {
    exportDate: new Date().toISOString(),
    userData
  };
}

/**
 * Delete all user data
 */
export async function deleteUserData(userId, env) {
  // Start transaction (D1 doesn't support transactions, so we'll do this carefully)
  
  try {
    // Delete click data
    await env.DB.prepare(`
      DELETE FROM clicks WHERE slug IN (
        SELECT slug FROM links WHERE owner_id = ?
      )
    `).bind(userId).run();
    
    // Delete click events
    await env.DB.prepare(`
      DELETE FROM click_events WHERE slug IN (
        SELECT slug FROM links WHERE owner_id = ?
      )
    `).bind(userId).run();
    
    // Delete link status changes
    await env.DB.prepare(`
      DELETE FROM link_status_changes WHERE slug IN (
        SELECT slug FROM links WHERE owner_id = ?
      )
    `).bind(userId).run();
    
    // Delete links from KV
    const links = await env.DB.prepare(`
      SELECT slug FROM links WHERE owner_id = ?
    `).bind(userId).all();
    
    for (const link of links.results || []) {
      await env.LINKS.delete(link.slug);
    }
    
    // Delete links from DB
    await env.DB.prepare(`
      DELETE FROM links WHERE owner_id = ?
    `).bind(userId).run();
    
    // Delete sessions
    await env.DB.prepare(`
      DELETE FROM sessions WHERE user_id = ?
    `).bind(userId).run();
    
    // Delete password reset tokens
    await env.DB.prepare(`
      DELETE FROM password_reset_tokens WHERE user_id = ?
    `).bind(userId).run();
    
    // Delete email verification tokens
    await env.DB.prepare(`
      DELETE FROM email_verification_tokens WHERE user_id = ?
    `).bind(userId).run();
    
    // Delete error logs
    await env.DB.prepare(`
      DELETE FROM error_logs WHERE user_id = ?
    `).bind(userId).run();
    
    // Mark user as deleted (soft delete to maintain referential integrity)
    await env.DB.prepare(`
      UPDATE users 
      SET status = 'deleted',
          email = CONCAT('deleted_', id, '@deleted.com'),
          name = 'Deleted User',
          password_hash = NULL,
          api_key = NULL,
          updated_at = unixepoch()
      WHERE id = ?
    `).bind(userId).run();
    
    // Log the deletion
    await env.DB.prepare(`
      INSERT INTO security_audit_log (user_id, event_type, event_data, created_at)
      VALUES (?, 'ACCOUNT_DELETED', '{"reason": "GDPR request"}', unixepoch())
    `).bind(userId).run();
    
    return {
      success: true,
      message: 'All user data has been deleted'
    };
  } catch (error) {
    throw new AppError(
      'Failed to delete user data',
      ErrorCategory.DATABASE,
      500,
      { error: error.message }
    );
  }
}

/**
 * Handle data export request
 */
export async function handleDataExport(request, env) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const session = await validateSession(token, env);
    
    if (!session) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const data = await exportUserData(session.user_id, env);
    
    // Log the export
    await env.DB.prepare(`
      INSERT INTO security_audit_log (user_id, event_type, event_data, created_at)
      VALUES (?, 'DATA_EXPORTED', '{}', unixepoch())
    `).bind(session.user_id).run();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="user-data-export.json"'
      }
    });
  } catch (error) {
    console.error('Data export error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to export data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle account deletion request
 */
export async function handleAccountDeletion(request, env) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const session = await validateSession(token, env);
    
    if (!session) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify password for security
    const { password } = await request.json();
    if (!password) {
      return new Response(JSON.stringify({
        error: 'Password confirmation required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify password matches
    const user = await env.DB.prepare(`
      SELECT password_hash FROM users WHERE id = ?
    `).bind(session.user_id).first();
    
    const { verifyPassword } = await import('./lib/auth-utils.js');
    const passwordValid = await verifyPassword(password, user.password_hash);
    
    if (!passwordValid) {
      return new Response(JSON.stringify({
        error: 'Invalid password'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await deleteUserData(session.user_id, env);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete account'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Privacy policy and terms acceptance
 */
export async function acceptPolicies(userId, policies, env) {
  const acceptedAt = Math.floor(Date.now() / 1000);
  
  await env.DB.prepare(`
    INSERT INTO policy_acceptances (user_id, policy_type, version, accepted_at, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    userId,
    policies.type, // 'privacy', 'terms', or 'both'
    policies.version || '1.0',
    acceptedAt,
    policies.ipAddress || null
  ).run();
  
  return { success: true, acceptedAt };
}

/**
 * Get user's policy acceptance status
 */
export async function getPolicyAcceptance(userId, env) {
  const acceptances = await env.DB.prepare(`
    SELECT policy_type, version, accepted_at
    FROM policy_acceptances
    WHERE user_id = ?
    ORDER BY accepted_at DESC
  `).bind(userId).all();
  
  return acceptances.results || [];
}