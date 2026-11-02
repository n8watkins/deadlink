// Security utilities extracted from main worker
// Phase 2: Links API

/**
 * Validate redirect URL to prevent open redirect attacks
 */
export function isValidRedirectUrl(url, env) {
  try {
    const parsedUrl = new URL(url);
    
    // Only allow HTTPS URLs (security requirement)
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }
    
    // Block localhost and private IP ranges to prevent SSRF
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // IPv4 private ranges
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,  // Complete 172.16-31 range
      /^169\.254\./,  // Link-local
      /^0\./,         // This network
      /^224\./,       // Multicast
      /^240\./        // Reserved
    ];
    
    // IPv6 patterns
    const ipv6Patterns = [
      /^::1$/,        // localhost
      /^::/,          // unspecified
      /^fe80:/i,      // link-local
      /^fc00:/i,      // unique local
      /^fd00:/i       // unique local
    ];
    
    const isPrivate = privatePatterns.some(p => p.test(hostname)) || 
                     ipv6Patterns.some(p => p.test(hostname));
    
    if (isPrivate) {
      return false;
    }
    
    // Check against allowed domains if configured
    if (env.ALLOWED_DOMAINS) {
      const allowedDomains = env.ALLOWED_DOMAINS.split(',').map(d => d.trim().toLowerCase());
      if (!allowedDomains.includes(hostname) && !allowedDomains.includes('*')) {
        return false;
      }
    }
    
    // Block suspicious patterns
    if (url.includes('javascript:') || 
        url.includes('data:') || 
        url.includes('vbscript:') ||
        url.includes('<script') ||
        url.includes('</script>')) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}