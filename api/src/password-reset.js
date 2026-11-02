/**
 * Password Reset Functionality
 * Secure password reset flow with email verification
 */

import { nanoid } from 'nanoid';
import { hashPassword, generateToken } from './lib/auth-utils.js';
import { AppError, ErrorCategory } from './error-logger.js';
import { getConfig } from './config.js';

/**
 * Generate password reset token
 */
export async function generateResetToken(email, env) {
  const user = await env.DB.prepare(
    'SELECT id, email FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();
  
  if (!user) {
    // Don't reveal if user exists
    return { success: true, message: 'If the email exists, a reset link has been sent.' };
  }
  
  // Generate secure token
  const token = generateToken();
  const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60); // 1 hour
  
  // Store token in database
  await env.DB.prepare(`
    INSERT INTO password_reset_tokens (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `).bind(user.id, token, expiresAt).run();
  
  // Queue email send (would integrate with email service)
  const resetUrl = `${getConfig(env).apiBaseUrl}/reset-password?token=${token}`;
  
  // In production, this would send an actual email
  console.log(`Password reset URL for ${email}: ${resetUrl}`);
  
  // Log security event
  await env.DB.prepare(`
    INSERT INTO security_audit_log (user_id, event_type, event_data, ip_address, created_at)
    VALUES (?, ?, ?, ?, unixepoch())
  `).bind(
    user.id,
    'PASSWORD_RESET_REQUESTED',
    JSON.stringify({ email }),
    null,
    
  ).run();
  
  return { success: true, message: 'If the email exists, a reset link has been sent.' };
}

/**
 * Validate reset token
 */
export async function validateResetToken(token, env) {
  const resetToken = await env.DB.prepare(`
    SELECT prt.*, u.email 
    FROM password_reset_tokens prt
    JOIN users u ON prt.user_id = u.id
    WHERE prt.token = ? 
      AND prt.expires_at > unixepoch()
      AND prt.used = 0
  `).bind(token).first();
  
  if (!resetToken) {
    throw new AppError('Invalid or expired reset token', ErrorCategory.AUTH, 400);
  }
  
  return {
    valid: true,
    userId: resetToken.user_id,
    email: resetToken.email
  };
}

/**
 * Reset password with token
 */
export async function resetPasswordWithToken(token, newPassword, env) {
  // Validate token
  const tokenData = await validateResetToken(token, env);
  
  // Validate password strength
  if (newPassword.length < 8) {
    throw new AppError('Password must be at least 8 characters', ErrorCategory.VALIDATION, 400);
  }
  
  // Hash new password
  const passwordHash = await hashPassword(newPassword);
  
  // Update user password
  await env.DB.prepare(`
    UPDATE users 
    SET password_hash = ?, updated_at = unixepoch()
    WHERE id = ?
  `).bind(passwordHash, tokenData.userId).run();
  
  // Mark token as used
  await env.DB.prepare(`
    UPDATE password_reset_tokens 
    SET used = 1 
    WHERE token = ?
  `).bind(token).run();
  
  // Invalidate all existing sessions for security
  await env.DB.prepare(`
    DELETE FROM sessions WHERE user_id = ?
  `).bind(tokenData.userId).run();
  
  // Log security event
  await env.DB.prepare(`
    INSERT INTO security_audit_log (user_id, event_type, event_data, created_at)
    VALUES (?, ?, ?, unixepoch())
  `).bind(
    tokenData.userId,
    'PASSWORD_RESET_COMPLETED',
    JSON.stringify({ email: tokenData.email })
  ).run();
  
  return { success: true, message: 'Password has been reset successfully.' };
}

/**
 * Handle password reset request endpoint
 */
export async function handlePasswordResetRequest(request, env) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return new Response(JSON.stringify({
        error: 'Email is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await generateResetToken(email, env);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process password reset request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle password reset completion endpoint
 */
export async function handlePasswordReset(request, env) {
  try {
    const { token, password } = await request.json();
    
    if (!token || !password) {
      return new Response(JSON.stringify({
        error: 'Token and password are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await resetPasswordWithToken(token, password, env);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof AppError) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.error('Password reset error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to reset password'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Clean up expired tokens (scheduled job)
 */
export async function cleanupExpiredTokens(env) {
  const deleted = await env.DB.prepare(`
    DELETE FROM password_reset_tokens 
    WHERE expires_at < unixepoch() 
      OR used = 1
  `).run();
  
  console.log(`Cleaned up ${deleted.meta.changes} expired password reset tokens`);
}