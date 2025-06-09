import { NextRequest, NextResponse } from 'next/server';
import { SECURITY_CONFIG } from '@/lib/security';

/**
 * 🛡️ Global Security Middleware
 * 
 * This middleware runs on every request to enforce security policies
 */

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // 1. Apply security headers globally
  Object.entries(SECURITY_CONFIG.SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // 2. Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    
    // Check if origin is allowed
    if (origin && (
      SECURITY_CONFIG.CORS.ALLOWED_ORIGINS.includes(origin) ||
      process.env.NODE_ENV === 'development'
    )) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    
    response.headers.set(
      'Access-Control-Allow-Methods', 
      SECURITY_CONFIG.CORS.ALLOWED_METHODS.join(', ')
    );
    response.headers.set(
      'Access-Control-Allow-Headers', 
      SECURITY_CONFIG.CORS.ALLOWED_HEADERS.join(', ')
    );
    response.headers.set('Access-Control-Max-Age', '86400');
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
  }
  
  // 3. Block access to sensitive paths in production
  if (process.env.NODE_ENV === 'production') {
    const sensitiveRoutes = [
      '/api/security-test',
      '/api/debug',
    ];
    
    if (sensitiveRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
      return NextResponse.json(
        { error: 'Access denied in production' },
        { status: 403 }
      );
    }
  }
  
  // 4. Add security headers specific to content type
  const pathname = request.nextUrl.pathname;
  
  if (pathname.startsWith('/api/')) {
    // API-specific headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('X-API-Version', '1.0');
  }
  
  if (pathname === '/' || pathname.startsWith('/chat')) {
    // Page-specific CSP
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://openrouter.ai https://*.supabase.co; font-src 'self' data:;"
    );
  }
  
  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}; 