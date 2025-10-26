/**
 * Google Maps API Key Route (for client-side map display)
 * Best Practices Implemented:
 * 1. API key is restricted by HTTP referrer in Google Cloud Console
 * 2. Rate limiting to prevent abuse
 * 3. Only returns key for map display, not for API calls
 * 4. Audit logging for security monitoring
 * 
 * IMPORTANT: Configure API Key restrictions in Google Cloud Console:
 * - Application restrictions: HTTP referrers
 * - Add your domain (e.g., https://yourdomain.com/*)
 * - API restrictions: Maps JavaScript API only
 */

import { NextRequest, NextResponse } from 'next/server';
import { mapsLimiter, getClientIdentifier } from '@/lib/rateLimiter';
import { auditLogger } from '@/lib/auditLogger';

export async function GET(req: NextRequest) {
  try {
    const clientId = getClientIdentifier(req);

    // Rate limiting (more lenient for key requests)
    const rateLimitResult = mapsLimiter.check(clientId);
    if (!rateLimitResult.allowed) {
      auditLogger.security('Maps key rate limit exceeded', { clientId }, clientId);
      return NextResponse.json(
        { error: 'Too many requests.' },
        { status: 429 }
      );
    }

    // Get Maps API key
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
      auditLogger.error('Maps API key not configured', { clientId }, clientId);
      return NextResponse.json(
        { error: 'Maps service not available.' },
        { status: 503 }
      );
    }

    auditLogger.info('Maps API key requested', { clientId }, clientId);

    // Return the key (safe because it's restricted in Google Cloud Console)
    return NextResponse.json({
      apiKey,
      message: 'Use only for Maps JavaScript API display',
    });

  } catch (error: any) {
    auditLogger.error('Maps key request failed', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to get API key.' },
      { status: 500 }
    );
  }
}
