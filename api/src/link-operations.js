/**
 * Enhanced Link Operations
 * Custom slugs, bulk operations, and link management
 */

import { nanoid } from 'nanoid';
import { validateSession } from './lib/auth-utils.js';
import { AppError, ErrorCategory } from './error-logger.js';
import { getConfig, getShortUrl } from './config.js';

/**
 * Validate custom slug
 */
function validateCustomSlug(slug) {
  // Only allow alphanumeric, dash, and underscore
  const slugRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  
  if (!slugRegex.test(slug)) {
    throw new AppError(
      'Slug must be 3-50 characters and contain only letters, numbers, dashes, and underscores',
      ErrorCategory.VALIDATION,
      400
    );
  }
  
  // Reserved slugs
  const reserved = ['api', 'admin', 'health', 'r', 'auth', 'dashboard', 'app'];
  if (reserved.includes(slug.toLowerCase())) {
    throw new AppError(
      'This slug is reserved',
      ErrorCategory.VALIDATION,
      400
    );
  }
  
  return true;
}

/**
 * Create link with optional custom slug
 */
export async function createLink(data, userId, env, request) {
  const config = getConfig(env, request);
  
  // Generate or validate slug
  let slug;
  if (data.customSlug) {
    validateCustomSlug(data.customSlug);
    slug = data.customSlug;
    
    // Check if slug already exists
    const existing = await env.LINKS.get(slug);
    if (existing) {
      throw new AppError(
        'This custom slug is already in use',
        ErrorCategory.VALIDATION,
        409
      );
    }
  } else {
    // Generate random slug
    slug = nanoid(6);
    
    // Ensure uniqueness (very rare but possible)
    let attempts = 0;
    while (await env.LINKS.get(slug) && attempts < 5) {
      slug = nanoid(6);
      attempts++;
    }
  }
  
  // Validate URLs
  try {
    new URL(data.url);
    if (data.fallbackUrls) {
      data.fallbackUrls.forEach(url => new URL(url));
    }
  } catch (error) {
    throw new AppError('Invalid URL provided', ErrorCategory.VALIDATION, 400);
  }
  
  // Prepare link data
  const linkData = {
    url: data.url,
    primary: data.url,
    active_url: data.url,
    fallback_1: data.fallbackUrls?.[0] || null,
    fallback_2: data.fallbackUrls?.[1] || null,
    fallback_3: data.fallbackUrls?.[2] || null,
    owner_id: userId,
    created_at: Date.now(),
    status: 'live',
    expires_at: data.expiresAt || null,
    category: data.category || null,
    tags: data.tags || [],
    metadata: data.metadata || {}
  };
  
  // Store in KV
  await env.LINKS.put(slug, JSON.stringify(linkData));
  
  // Store in D1
  await env.DB.prepare(`
    INSERT INTO links (
      slug, primary_url, owner_id, status, expires_at, 
      category, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).bind(
    slug,
    data.url,
    userId,
    'live',
    linkData.expires_at,
    linkData.category
  ).run();
  
  return {
    slug,
    shortUrl: getShortUrl(slug, config),
    url: data.url,
    customSlug: !!data.customSlug,
    expiresAt: linkData.expires_at,
    category: linkData.category
  };
}

/**
 * Bulk create links
 */
export async function bulkCreateLinks(links, userId, env, request) {
  const results = [];
  const errors = [];
  
  // Validate bulk size
  if (links.length > 100) {
    throw new AppError(
      'Maximum 100 links per bulk operation',
      ErrorCategory.VALIDATION,
      400
    );
  }
  
  for (let i = 0; i < links.length; i++) {
    try {
      const result = await createLink(links[i], userId, env, request);
      results.push({ index: i, ...result });
    } catch (error) {
      errors.push({
        index: i,
        error: error.message,
        url: links[i].url
      });
    }
  }
  
  return {
    created: results.length,
    failed: errors.length,
    results,
    errors
  };
}

/**
 * Bulk delete links
 */
export async function bulkDeleteLinks(slugs, userId, env) {
  const results = {
    deleted: [],
    notFound: [],
    unauthorized: []
  };
  
  // Validate bulk size
  if (slugs.length > 100) {
    throw new AppError(
      'Maximum 100 links per bulk operation',
      ErrorCategory.VALIDATION,
      400
    );
  }
  
  for (const slug of slugs) {
    // Check ownership
    const link = await env.DB.prepare(`
      SELECT owner_id FROM links WHERE slug = ?
    `).bind(slug).first();
    
    if (!link) {
      results.notFound.push(slug);
      continue;
    }
    
    if (link.owner_id !== userId) {
      results.unauthorized.push(slug);
      continue;
    }
    
    // Delete from KV
    await env.LINKS.delete(slug);
    
    // Delete from DB (cascade will handle related records)
    await env.DB.prepare(`
      DELETE FROM links WHERE slug = ?
    `).bind(slug).run();
    
    results.deleted.push(slug);
  }
  
  return results;
}

/**
 * Update link
 */
export async function updateLink(slug, updates, userId, env) {
  // Check ownership
  const link = await env.DB.prepare(`
    SELECT owner_id FROM links WHERE slug = ?
  `).bind(slug).first();
  
  if (!link) {
    throw new AppError('Link not found', ErrorCategory.VALIDATION, 404);
  }
  
  if (link.owner_id !== userId) {
    throw new AppError('Unauthorized', ErrorCategory.PERMISSION, 403);
  }
  
  // Get current data from KV
  const linkData = await env.LINKS.get(slug, 'json');
  if (!linkData) {
    throw new AppError('Link data not found', ErrorCategory.VALIDATION, 404);
  }
  
  // Update allowed fields
  if (updates.url) {
    try {
      new URL(updates.url);
      linkData.url = updates.url;
      linkData.primary = updates.url;
      linkData.active_url = updates.url;
    } catch (error) {
      throw new AppError('Invalid URL', ErrorCategory.VALIDATION, 400);
    }
  }
  
  if (updates.fallbackUrls) {
    linkData.fallback_1 = updates.fallbackUrls[0] || null;
    linkData.fallback_2 = updates.fallbackUrls[1] || null;
    linkData.fallback_3 = updates.fallbackUrls[2] || null;
  }
  
  if (updates.category !== undefined) {
    linkData.category = updates.category;
  }
  
  if (updates.tags !== undefined) {
    linkData.tags = updates.tags;
  }
  
  if (updates.expiresAt !== undefined) {
    linkData.expires_at = updates.expiresAt;
  }
  
  if (updates.metadata !== undefined) {
    linkData.metadata = { ...linkData.metadata, ...updates.metadata };
  }
  
  // Update KV
  await env.LINKS.put(slug, JSON.stringify(linkData));
  
  // Update DB
  await env.DB.prepare(`
    UPDATE links 
    SET primary_url = ?,
        expires_at = ?,
        category = ?,
        updated_at = unixepoch()
    WHERE slug = ?
  `).bind(
    linkData.url,
    linkData.expires_at,
    linkData.category,
    slug
  ).run();
  
  return {
    slug,
    updated: true
  };
}

/**
 * Handle link expiration
 */
export async function checkLinkExpiration(slug, linkData) {
  if (!linkData.expires_at) return false;
  
  const now = Date.now();
  return now > linkData.expires_at;
}

/**
 * Get user's link categories
 */
export async function getLinkCategories(userId, env) {
  const categories = await env.DB.prepare(`
    SELECT DISTINCT category, COUNT(*) as count
    FROM links
    WHERE owner_id = ? AND category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
  `).bind(userId).all();
  
  return categories.results || [];
}

/**
 * Bulk update link status
 */
export async function bulkUpdateStatus(updates, userId, env) {
  const results = {
    updated: [],
    failed: []
  };
  
  for (const update of updates) {
    try {
      // Verify ownership
      const link = await env.DB.prepare(`
        SELECT owner_id FROM links WHERE slug = ?
      `).bind(update.slug).first();
      
      if (!link || link.owner_id !== userId) {
        results.failed.push({
          slug: update.slug,
          error: 'Not found or unauthorized'
        });
        continue;
      }
      
      // Update status
      await env.DB.prepare(`
        UPDATE links 
        SET status = ?, updated_at = unixepoch()
        WHERE slug = ?
      `).bind(update.status, update.slug).run();
      
      // Update KV
      const linkData = await env.LINKS.get(update.slug, 'json');
      if (linkData) {
        linkData.status = update.status;
        await env.LINKS.put(update.slug, JSON.stringify(linkData));
      }
      
      results.updated.push(update.slug);
    } catch (error) {
      results.failed.push({
        slug: update.slug,
        error: error.message
      });
    }
  }
  
  return results;
}