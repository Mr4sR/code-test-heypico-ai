/**
 * Google Places API Route
 * Best Practices Implemented:
 * 1. Server-side API key handling (never exposed to client)
 * 2. Rate limiting per client
 * 3. Response caching to reduce API calls and costs
 * 4. Input validation and sanitization
 * 5. Usage tracking and limits
 * 6. Error handling with proper status codes
 * 7. Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { mapsLimiter, getClientIdentifier } from '@/lib/rateLimiter';
import { validateLocationQuery } from '@/lib/validation';
import { apiKeyManager } from '@/lib/apiKeyManager';
import { auditLogger } from '@/lib/auditLogger';
import { placesCache } from '@/lib/cache';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let clientId = 'unknown';

  try {
    clientId = getClientIdentifier(req);

    // Rate limiting check
    if (process.env.ENABLE_RATE_LIMITING === 'true') {
      const rateLimitResult = mapsLimiter.check(clientId);
      
      if (!rateLimitResult.allowed) {
        auditLogger.warn('Maps rate limit exceeded', { clientId }, clientId);
        return NextResponse.json(
          { 
            error: 'Too many requests. Please try again later.',
            resetAt: new Date(rateLimitResult.resetAt).toISOString(),
          },
          { status: 429 }
        );
      }
    }

    // Parse request body
    const body = await req.json();
    const { query, location, type = 'restaurant' } = body;

    // Validate query
    const validation = validateLocationQuery(query);
    if (!validation.valid) {
      auditLogger.warn('Invalid places query', { error: validation.error, clientId }, clientId);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Create cache key
    const cacheKey = `places:${query}:${location || ''}:${type}`;

    // Check cache first
    const cachedData = placesCache.get(cacheKey);
    if (cachedData) {
      auditLogger.info('Places request served from cache', { 
        clientId, 
        query,
        cacheHit: true,
      }, clientId);
      
      return NextResponse.json({
        ...cachedData,
        cached: true,
      });
    }

    // Get API key
    const apiKey = apiKeyManager.getGoogleMapsKey();
    if (!apiKey) {
      auditLogger.error('Google Maps API key unavailable', { clientId }, clientId);
      return NextResponse.json(
        { error: 'Maps service temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    // Build Places API (New) request
    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.rating',
      'places.userRatingCount',
      'places.types',
      'places.photos',
      'places.priceLevel',
    ].join(',');

    // Check if location is coordinates (lat,lng) or place name
    const isCoordinates = location && /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location);
    
    const requestBody: any = {
      textQuery: query,
    };

    // If location is coordinates, use locationBias for nearby search
    if (isCoordinates) {
      const [lat, lng] = location.split(',').map(Number);
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: 5000.0, // 5km radius for nearby search
        },
      };
      console.log('Using location bias with coordinates:', { lat, lng });
    }

    // Call Google Places API (New)
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-Fieldmask': fieldMask,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      auditLogger.error('Places API (New) request failed', {
        status: response.status,
        error: errorBody,
        clientId,
      }, clientId);
      throw new Error(`Places API (New) error: ${response.status} ${errorBody}`);
    }

    const data = await response.json();

    // The new API doesn't have a 'status' field in the same way.
    // A non-200 response is an error. An empty 'places' array is the equivalent of ZERO_RESULTS.
    if (!data.places || data.places.length === 0) {
      auditLogger.info('No places found for query', { query, clientId }, clientId);
      // Cache the empty result to prevent repeated lookups
      const emptyResult = { places: [], usage: apiKeyManager.getUsageStats().googleMaps };
      placesCache.set(cacheKey, emptyResult);
      return NextResponse.json(emptyResult);
    }

    // Format response
    const places = data.places.slice(0, 10).map((place: any) => ({
      id: place.id,
      name: place.displayName?.text || place.displayName || 'Unknown Place',
      address: place.formattedAddress || 'Address not available',
      location: {
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
      },
      rating: place.rating,
      userRatingsTotal: place.userRatingCount,
      types: place.types,
      // The new photo name includes the full resource path.
      // We extract just the reference similar to the old API for client-side use.
      photoReference: place.photos?.[0]?.name,
      priceLevel: place.priceLevel,
      openNow: place.opening_hours?.open_now,
    })) || [];

    const result = {
      places,
      count: places.length,
      query,
    };

    // Cache the result (1 hour)
    placesCache.set(cacheKey, result, 3600000);

    auditLogger.info('Places request successful', {
      clientId,
      query,
      resultsCount: places.length,
      duration: Date.now() - startTime,
      cacheHit: false,
    }, clientId);

    return NextResponse.json({
      ...result,
      cached: false,
      usage: apiKeyManager.getUsageStats().googleMaps,
    });

  } catch (error: any) {
    auditLogger.error('Places request failed', {
      clientId,
      error: error.message,
      duration: Date.now() - startTime,
    }, clientId);

    return NextResponse.json(
      { error: 'An error occurred while searching places.' },
      { status: 500 }
    );
  }
}
