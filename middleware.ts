/**
 * API Security Headers Middleware
 * Adds security headers to all API responses
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // Security Headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  
  // CORS Headers (adjust for your production domain)
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    // Add your production domain here:
    // 'https://yourdomain.com',
    // 'https://www.yourdomain.com',
  ];

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  }

  // Rate Limit Headers (will be added by individual routes)
  // Content Security Policy for API responses
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none';"
  );

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
