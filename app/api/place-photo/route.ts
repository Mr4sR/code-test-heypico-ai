import { NextRequest, NextResponse } from 'next/server';
import { apiKeyManager } from '@/lib/apiKeyManager';
import { auditLogger } from '@/lib/auditLogger';
import { mapsLimiter, getClientIdentifier } from '@/lib/rateLimiter';

// Proxy endpoint to fetch place photos using server-side API key
// Query params: ref (photo resource name or reference), maxwidth (optional)
export async function GET(req: NextRequest) {
  const clientId = getClientIdentifier(req);

  // Rate limiting check
  const rateLimitResult = mapsLimiter.check(clientId);
  if (!rateLimitResult.allowed) {
    auditLogger.warn('Rate limit exceeded for place photo', { clientId }, clientId);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        }
      }
    );
  }

  const url = new URL(req.url);
  const ref = url.searchParams.get('ref');
  const maxwidth = url.searchParams.get('maxwidth') || '400';

  if (!ref) {
    return NextResponse.json({ error: 'Missing photo reference' }, { status: 400 });
  }

  const apiKey = apiKeyManager.getGoogleMapsKey();
  if (!apiKey) {
    auditLogger.error('Google Maps API key unavailable for photo proxy');
    return NextResponse.json({ error: 'Maps service unavailable' }, { status: 503 });
  }

  try {
    // The new Places API returns photo resource names in format:
    // "places/{place_id}/photos/{photo_id}"
    // We need to use the new Places Photo API endpoint
    
    // Build the photo media URL using the new API format
    const photoUrl = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${encodeURIComponent(
      maxwidth
    )}&key=${encodeURIComponent(apiKey)}`;

    const resp = await fetch(photoUrl, { 
      method: 'GET',
      redirect: 'follow'
    });
    
    if (!resp.ok) {
      const text = await resp.text();
      auditLogger.warn('Place photo fetch failed', { status: resp.status, body: text.substring(0, 200) });
      return NextResponse.json({ error: 'Failed to fetch photo' }, { status: resp.status });
    }

    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    auditLogger.error('Error proxying place photo', { error: err.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
