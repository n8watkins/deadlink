/**
 * QR Code Generation
 * Generate QR codes for short links
 */

import { getShortUrl } from './config.js';

/**
 * Generate QR code using external API (could also use a library)
 * In production, consider using a library like qr-code-generator
 */
export async function generateQRCode(slug, options = {}, env, request) {
  const config = getConfig(env, request);
  const shortUrl = getShortUrl(slug, config);
  
  // Default options
  const qrOptions = {
    size: options.size || 200,
    format: options.format || 'png',
    errorCorrection: options.errorCorrection || 'M',
    margin: options.margin || 4,
    color: options.color || '000000',
    background: options.background || 'FFFFFF',
    logo: options.logo || null
  };
  
  // For MVP, use a simple QR API service
  // In production, generate locally for better performance
  const qrApiUrl = new URL('https://api.qrserver.com/v1/create-qr-code/');
  qrApiUrl.searchParams.set('data', shortUrl);
  qrApiUrl.searchParams.set('size', `${qrOptions.size}x${qrOptions.size}`);
  qrApiUrl.searchParams.set('format', qrOptions.format);
  qrApiUrl.searchParams.set('ecc', qrOptions.errorCorrection);
  qrApiUrl.searchParams.set('margin', qrOptions.margin);
  qrApiUrl.searchParams.set('color', qrOptions.color);
  qrApiUrl.searchParams.set('bgcolor', qrOptions.background);
  
  try {
    const response = await fetch(qrApiUrl.toString());
    
    if (!response.ok) {
      throw new Error('Failed to generate QR code');
    }
    
    const imageBuffer = await response.arrayBuffer();
    
    // Cache in KV for 24 hours
    const cacheKey = `qr:${slug}:${JSON.stringify(qrOptions)}`;
    await env.LINKS.put(cacheKey, imageBuffer, {
      expirationTtl: 86400 // 24 hours
    });
    
    return {
      buffer: imageBuffer,
      contentType: `image/${qrOptions.format}`,
      cached: false
    };
  } catch (error) {
    console.error('QR generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Get cached QR code
 */
export async function getCachedQRCode(slug, options, env) {
  const cacheKey = `qr:${slug}:${JSON.stringify(options)}`;
  const cached = await env.LINKS.get(cacheKey, { type: 'arrayBuffer' });
  
  if (cached) {
    return {
      buffer: cached,
      contentType: `image/${options.format || 'png'}`,
      cached: true
    };
  }
  
  return null;
}

/**
 * Handle QR code request
 */
export async function handleQRCodeRequest(request, env) {
  const url = new URL(request.url);
  const slug = url.pathname.split('/').pop();
  
  // Validate slug exists
  const link = await env.LINKS.get(slug);
  if (!link) {
    return new Response('Link not found', { status: 404 });
  }
  
  // Parse options from query params
  const options = {
    size: parseInt(url.searchParams.get('size') || '200'),
    format: url.searchParams.get('format') || 'png',
    errorCorrection: url.searchParams.get('ecc') || 'M',
    margin: parseInt(url.searchParams.get('margin') || '4'),
    color: url.searchParams.get('color') || '000000',
    background: url.searchParams.get('bg') || 'FFFFFF'
  };
  
  // Validate options
  if (options.size < 50 || options.size > 1000) {
    return new Response('Size must be between 50 and 1000', { status: 400 });
  }
  
  if (!['png', 'svg', 'jpeg'].includes(options.format)) {
    return new Response('Format must be png, svg, or jpeg', { status: 400 });
  }
  
  try {
    // Check cache first
    let qrCode = await getCachedQRCode(slug, options, env);
    
    if (!qrCode) {
      // Generate new QR code
      qrCode = await generateQRCode(slug, options, env, request);
    }
    
    return new Response(qrCode.buffer, {
      headers: {
        'Content-Type': qrCode.contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': qrCode.cached ? 'HIT' : 'MISS'
      }
    });
  } catch (error) {
    return new Response('Failed to generate QR code', { status: 500 });
  }
}

/**
 * Generate QR code with custom branding
 */
export async function generateBrandedQRCode(slug, brandingOptions, env, request) {
  // This would integrate with a more advanced QR generator
  // that supports logos, custom patterns, etc.
  
  const options = {
    ...brandingOptions,
    logo: brandingOptions.logoUrl,
    pattern: brandingOptions.pattern || 'square',
    cornerRadius: brandingOptions.cornerRadius || 0,
    dotStyle: brandingOptions.dotStyle || 'square'
  };
  
  // For MVP, just use standard QR with color customization
  return generateQRCode(slug, options, env, request);
}

// Import getConfig
import { getConfig } from './config.js';