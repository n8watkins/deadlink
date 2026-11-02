/**
 * Simple CORS middleware with support for multiple origins
 */
const ALLOWED_ORIGINS = [
  'https://deadlink.io',
  'https://app.deadlink.io',
  'http://localhost:3000',    // App development
  'http://localhost:3001'     // Landing development
];

export function addCorsHeaders(response, request) {
  const origin = request.headers.get('Origin');
  const headers = new Headers(response.headers);
  
  // Check if origin is in allowed list
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  } else if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    // Allow any localhost port in development
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization, X-CSRF-Token');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Expose-Headers', 'X-CSRF-Token');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Handle OPTIONS requests
 */
export function handleOptions(request) {
  return addCorsHeaders(new Response(null, { status: 204 }), request);
}