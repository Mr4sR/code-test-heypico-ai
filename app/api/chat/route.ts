/**
 * Google AI Studio (Gemini) Chat API Route
 * Best Practices Implemented:
 * 1. Rate limiting per client
 * 2. Input validation and sanitization
 * 3. API key security (server-side only)
 * 4. Usage tracking and limits
 * 5. Error handling with proper status codes
 * 6. Audit logging
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { aiChatLimiter, getClientIdentifier } from '@/lib/rateLimiter';
import { validateMessage, validateHistory } from '@/lib/validation';
import { apiKeyManager } from '@/lib/apiKeyManager';
import { auditLogger } from '@/lib/auditLogger';

// Safety settings for content filtering
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let clientId = 'unknown';

  try {
    // Get client identifier for rate limiting and logging
    clientId = getClientIdentifier(req);

    // Rate limiting check
    if (process.env.ENABLE_RATE_LIMITING === 'true') {
      const rateLimitResult = aiChatLimiter.check(clientId);
      
      if (!rateLimitResult.allowed) {
        auditLogger.warn('Rate limit exceeded', { clientId }, clientId);
        return NextResponse.json(
          { 
            error: 'Too many requests. Please try again later.',
            resetAt: new Date(rateLimitResult.resetAt).toISOString(),
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': String(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
              'X-RateLimit-Remaining': String(rateLimitResult.remaining),
              'X-RateLimit-Reset': String(rateLimitResult.resetAt),
            }
          }
        );
      }
    }

    // Parse and validate request body
    const body = await req.json();
    const { message, history = [], userLocation } = body;

    // Validate message
    const messageValidation = validateMessage(message);
    if (!messageValidation.valid) {
      auditLogger.warn('Invalid message', { error: messageValidation.error, clientId }, clientId);
      return NextResponse.json(
        { error: messageValidation.error },
        { status: 400 }
      );
    }

    // Validate history
    const historyValidation = validateHistory(history);
    if (!historyValidation.valid) {
      auditLogger.warn('Invalid history', { error: historyValidation.error, clientId }, clientId);
      return NextResponse.json(
        { error: historyValidation.error },
        { status: 400 }
      );
    }

    // Get API key from secure manager
    const apiKey = apiKeyManager.getGoogleAiKey();
    if (!apiKey) {
      auditLogger.error('Google AI API key unavailable', { clientId }, clientId);
      return NextResponse.json(
        { error: 'AI service temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    // Initialize Google AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      safetySettings: safetySettings,
    });

    // System prompt for location detection
    const locationContext = userLocation 
      ? `\n\nIMPORTANT: The user's current location is at coordinates (${userLocation.lat}, ${userLocation.lng}). When they ask for nearby places or don't specify a location, use their current coordinates in the "location" field as "${userLocation.lat},${userLocation.lng}" instead of a city name.`
      : '';

    const systemPrompt = `You are a helpful AI assistant with the ability to search for places and locations. 
When users ask about places to eat, visit, shop, or any location-based queries, you should:
1. Understand their intent and extract the location type and area
2. Respond naturally while indicating you'll search for places
3. Include a JSON object in your response with this exact format:
{
  "action": "search_places",
  "query": "restaurants in Jakarta",
  "type": "restaurant",
  "location": "Jakarta"
}

The JSON should be on its own line after your natural language response.
Available place types: restaurant, cafe, hotel, tourist_attraction, store, park, museum, etc.

For non-location queries, just respond normally without the JSON object.${locationContext}

IMPORTANT RULES:
- If user asks for "nearby" or "near me" or doesn't specify location, use their coordinates: "${userLocation ? `${userLocation.lat},${userLocation.lng}` : 'user location'}"
- If user specifies a city/area name, use that name as location
- Location field can be either city name (e.g., "Jakarta") OR coordinates (e.g., "-6.2088,106.8456")`;

    // Start chat with history
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I will help users find places and include the search JSON when appropriate.' }],
        },
        ...history.map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        })),
      ],
    });

    // Send message and get response
    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();

    // Log successful request
    auditLogger.info('AI chat request successful', {
      clientId,
      messageLength: message.length,
      responseLength: text.length,
      duration: Date.now() - startTime,
    }, clientId);

    // Parse response for location actions
    let locationAction = null;
    const jsonMatch = text.match(/\{[\s\S]*?"action":\s*"search_places"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        locationAction = JSON.parse(jsonMatch[0]);
      } catch (e) {
        // If JSON parsing fails, ignore it
        auditLogger.warn('Failed to parse location action', { error: e }, clientId);
      }
    }

    return NextResponse.json({
      response: text,
      locationAction,
      usage: apiKeyManager.getUsageStats().googleAi,
    });

  } catch (error: any) {
    auditLogger.error('AI chat request failed', {
      clientId,
      error: error.message,
      duration: Date.now() - startTime,
    }, clientId);

    // Handle specific error types
    if (error.message?.includes('quota')) {
      return NextResponse.json(
        { error: 'Service quota exceeded. Please try again later.' },
        { status: 503 }
      );
    }

    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'Service configuration error.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An error occurred while processing your request.' },
      { status: 500 }
    );
  }
}
