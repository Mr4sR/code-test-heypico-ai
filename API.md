# API Documentation

## Base URL
- Development: `http://localhost:3000`
- Production: `https://yourdomain.com`

## Authentication
No authentication required for current version. All security is handled via:
- Rate limiting per client (IP + User-Agent)
- Server-side API key management
- Input validation

---

## Endpoints

### 1. Chat with AI

Send a message to the AI assistant and receive a response.

**Endpoint:** `POST /api/chat`

**Rate Limit:** 10 requests per 60 seconds (configurable)

**Request Body:**
```json
{
  "message": "string (required, max 5000 chars)",
  "history": [
    {
      "role": "user | model",
      "content": "string"
    }
  ]
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find good restaurants in Jakarta",
    "history": [
      {
        "role": "user",
        "content": "Hello"
      },
      {
        "role": "model",
        "content": "Hi! How can I help you today?"
      }
    ]
  }'
```

**Success Response (200 OK):**
```json
{
  "response": "I'll help you find restaurants in Jakarta. Let me search for some great options...",
  "locationAction": {
    "action": "search_places",
    "query": "restaurants in Jakarta",
    "type": "restaurant",
    "location": "Jakarta"
  },
  "usage": {
    "count": 15,
    "limit": 1500,
    "remaining": 1485
  }
}
```

**Response Fields:**
- `response` (string): AI-generated text response
- `locationAction` (object | null): Location search trigger (if applicable)
  - `action` (string): Always "search_places"
  - `query` (string): Full search query
  - `type` (string): Place type (restaurant, cafe, hotel, etc.)
  - `location` (string): Location name or coordinates
- `usage` (object): API usage statistics
  - `count` (number): Requests used today
  - `limit` (number): Daily limit
  - `remaining` (number): Remaining requests

**Error Responses:**

**400 Bad Request - Invalid Input**
```json
{
  "error": "Message is required"
}
```
```json
{
  "error": "Message is too long (max 5000 characters)"
}
```
```json
{
  "error": "History is too long (max 50 messages)"
}
```

**429 Too Many Requests - Rate Limit Exceeded**
```json
{
  "error": "Too many requests. Please try again later.",
  "resetAt": "2024-10-26T12:00:00.000Z"
}
```

Response Headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1698765432000
```

**503 Service Unavailable - API Key Issues**
```json
{
  "error": "AI service temporarily unavailable. Please try again later."
}
```
```json
{
  "error": "Service quota exceeded. Please try again later."
}
```

**500 Internal Server Error**
```json
{
  "error": "An error occurred while processing your request."
}
```

---

### 2. Search Places

Search for places using Google Places API.

**Endpoint:** `POST /api/places`

**Rate Limit:** 10 requests per 60 seconds (configurable)

**Caching:** Responses cached for 1 hour

**Request Body:**
```json
{
  "query": "string (required, max 200 chars)",
  "location": "string (optional)",
  "type": "string (optional)"
}
```

**Place Types:**
- `restaurant` - Restaurants
- `cafe` - Cafes
- `hotel` - Hotels
- `tourist_attraction` - Tourist attractions
- `store` - Stores/shops
- `park` - Parks
- `museum` - Museums
- `bar` - Bars
- `gym` - Gyms
- `shopping_mall` - Shopping malls
- And more: [Full list](https://developers.google.com/maps/documentation/places/web-service/supported_types)

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/places \
  -H "Content-Type: application/json" \
  -d '{
    "query": "restaurants in Jakarta",
    "type": "restaurant",
    "location": "Jakarta"
  }'
```

**Success Response (200 OK):**
```json
{
  "places": [
    {
      "id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "name": "Restaurant Name",
      "address": "123 Main Street, Jakarta, Indonesia",
      "location": {
        "lat": -6.2088,
        "lng": 106.8456
      },
      "rating": 4.5,
      "userRatingsTotal": 1250,
      "types": ["restaurant", "food", "point_of_interest"],
      "photoReference": "CmRaAAAA...",
      "priceLevel": 2,
      "openNow": true
    }
  ],
  "count": 10,
  "query": "restaurants in Jakarta",
  "cached": false,
  "usage": {
    "count": 5,
    "limit": 10000,
    "remaining": 9995
  }
}
```

**Response Fields:**
- `places` (array): Array of place objects (max 10)
  - `id` (string): Google Place ID
  - `name` (string): Place name
  - `address` (string): Formatted address
  - `location` (object): Coordinates
    - `lat` (number): Latitude
    - `lng` (number): Longitude
  - `rating` (number | undefined): Average rating (0-5)
  - `userRatingsTotal` (number | undefined): Number of reviews
  - `types` (array | undefined): Place type tags
  - `photoReference` (string | undefined): Reference for place photo
  - `priceLevel` (number | undefined): Price level (0-4)
  - `openNow` (boolean | undefined): Currently open status
- `count` (number): Number of results returned
- `query` (string): Original search query
- `cached` (boolean): Whether result was from cache
- `usage` (object): API usage statistics

**Cache Hit Response:**
Same as above but with `"cached": true`

**Error Responses:**

**400 Bad Request - Invalid Input**
```json
{
  "error": "Query is required"
}
```
```json
{
  "error": "Query is too long (max 200 characters)"
}
```

**429 Too Many Requests**
```json
{
  "error": "Too many requests. Please try again later.",
  "resetAt": "2024-10-26T12:00:00.000Z"
}
```

**503 Service Unavailable**
```json
{
  "error": "Maps service temporarily unavailable. Please try again later."
}
```
```json
{
  "error": "Service quota exceeded. Please try again later."
}
```

**500 Internal Server Error**
```json
{
  "error": "An error occurred while searching places."
}
```

---

### 3. Get Maps API Key

Get the Google Maps API key for client-side map display.

**Endpoint:** `GET /api/maps-key`

**Rate Limit:** 10 requests per 60 seconds (configurable)

**Security Note:** The key returned is restricted to Maps JavaScript API only and should have HTTP referrer restrictions set in Google Cloud Console.

**Request Example:**
```bash
curl -X GET http://localhost:3000/api/maps-key
```

**Success Response (200 OK):**
```json
{
  "apiKey": "AIzaSy...",
  "message": "Use only for Maps JavaScript API display"
}
```

**Response Fields:**
- `apiKey` (string): Google Maps API key (restricted)
- `message` (string): Usage reminder

**Error Responses:**

**429 Too Many Requests**
```json
{
  "error": "Too many requests."
}
```

**503 Service Unavailable**
```json
{
  "error": "Maps service not available."
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to get API key."
}
```

---

## Rate Limiting

### How It Works
- Uses token bucket algorithm
- Limit applies per client (identified by IP + User-Agent)
- Tokens refill automatically over time
- Separate limits for each endpoint

### Default Limits
- Chat API: 10 requests per 60 seconds
- Places API: 10 requests per 60 seconds
- Maps Key API: 10 requests per 60 seconds

### Configuration
Edit `.env.local`:
```env
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000
```

### Response Headers
When rate limited, responses include:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1698765432000
```

### Handling Rate Limits

**Client-Side Example:**
```typescript
async function callAPI() {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'Hello' })
  });

  if (response.status === 429) {
    const data = await response.json();
    const resetAt = new Date(data.resetAt);
    console.log(`Rate limited. Try again at ${resetAt}`);
    
    // Wait and retry
    const waitMs = resetAt.getTime() - Date.now();
    await new Promise(resolve => setTimeout(resolve, waitMs));
    return callAPI(); // Retry
  }

  return response.json();
}
```

---

## Caching

### Places API Caching
- **TTL**: 1 hour (3600000ms)
- **Cache Key Format**: `places:{query}:{location}:{type}`
- **Benefit**: Reduces API calls by ~80%

### Cache Headers
Cached responses include:
```json
{
  "cached": true,
  // ... rest of response
}
```

### Cache Behavior
1. First request: Cache miss, fetch from Google Places API
2. Subsequent requests (within 1 hour): Cache hit, instant response
3. After 1 hour: Cache expired, fetch fresh data

### Clearing Cache
Cache is automatically cleaned up every 10 minutes. For manual clearing during development:
```typescript
import { placesCache } from '@/lib/cache';
placesCache.clear();
```

---

## Usage Quotas

### Google AI Studio (Gemini)
- **Free Tier**: 60 RPM, 1500 RPD
- **Tracking**: Automatic daily counter
- **Reset**: Automatic at 24-hour intervals

### Google Maps Platform
- **Places API**: $17 per 1000 requests (after $200 credit)
- **Maps JavaScript API**: $7 per 1000 loads
- **Tracking**: Configurable daily limit

### Monitoring Usage
Usage stats are included in API responses:
```json
{
  "usage": {
    "count": 15,      // Requests used today
    "limit": 1500,    // Daily limit
    "remaining": 1485 // Remaining requests
  }
}
```

### When Quota Exceeded
- Returns 503 Service Unavailable
- Automatic reset after 24 hours
- Manual reset via API key manager (development)

---

## Error Handling Best Practices

### Client-Side Error Handling

```typescript
async function chatWithAI(message: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    // Handle rate limiting
    if (response.status === 429) {
      const data = await response.json();
      throw new Error(`Rate limited. Try again at ${data.resetAt}`);
    }

    // Handle bad request
    if (response.status === 400) {
      const data = await response.json();
      throw new Error(`Invalid input: ${data.error}`);
    }

    // Handle service unavailable
    if (response.status === 503) {
      throw new Error('Service temporarily unavailable');
    }

    // Handle server error
    if (!response.ok) {
      throw new Error('An error occurred');
    }

    return await response.json();
  } catch (error) {
    console.error('Chat error:', error);
    // Show user-friendly error message
    throw error;
  }
}
```

### Retry Strategy

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // Retry server errors (5xx)
      if (response.ok) {
        return response;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

---

## Security Considerations

### API Key Security
- ✅ Keys stored server-side only
- ✅ Never exposed in client bundles
- ✅ Environment variable configuration
- ✅ Automatic usage tracking

### Input Validation
- ✅ Type checking
- ✅ Length limits
- ✅ XSS prevention (HTML tag removal)
- ✅ Structure validation

### Rate Limiting
- ✅ Token bucket algorithm
- ✅ Per-client limits
- ✅ Automatic cleanup

### Error Messages
- ✅ Generic messages to users
- ✅ Detailed logs server-side
- ✅ No stack trace exposure

---

## Testing Examples

### Testing Chat API

```bash
# Valid request
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, how are you?"}'

# With conversation history
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me more",
    "history": [
      {"role": "user", "content": "What is Jakarta?"},
      {"role": "model", "content": "Jakarta is the capital of Indonesia..."}
    ]
  }'

# Location query
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Find restaurants near SCBD Jakarta"}'
```

### Testing Places API

```bash
# Basic search
curl -X POST http://localhost:3000/api/places \
  -H "Content-Type: application/json" \
  -d '{"query":"restaurants in Jakarta"}'

# With type filter
curl -X POST http://localhost:3000/api/places \
  -H "Content-Type: application/json" \
  -d '{
    "query": "best coffee shops in Jakarta",
    "type": "cafe"
  }'

# With location
curl -X POST http://localhost:3000/api/places \
  -H "Content-Type: application/json" \
  -d '{
    "query": "tourist attractions",
    "location": "Jakarta",
    "type": "tourist_attraction"
  }'
```

### Testing Rate Limiting

```bash
# PowerShell
for ($i=1; $i -le 15; $i++) {
  Write-Host "Request $i"
  curl -X POST http://localhost:3000/api/chat `
    -H "Content-Type: application/json" `
    -d '{"message":"Test"}' `
    -w "`nStatus: %{http_code}`n"
}

# Should see 429 after 10 requests
```

### Testing Cache

```bash
# First request (cache miss)
curl -X POST http://localhost:3000/api/places \
  -H "Content-Type: application/json" \
  -d '{"query":"pizza in Jakarta"}' \
  -w "\nTime: %{time_total}s\n"

# Second request (cache hit - should be faster)
curl -X POST http://localhost:3000/api/places \
  -H "Content-Type: application/json" \
  -d '{"query":"pizza in Jakarta"}' \
  -w "\nTime: %{time_total}s\n"

# Check response includes "cached": true
```

---

## Integration Examples

### React/Next.js Integration

```typescript
// hooks/useChat.ts
import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (content: string) => {
    setIsLoading(true);
    
    // Add user message
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Prepare history
      const history = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        content: msg.content
      }));

      // Call API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      // Add AI message
      const aiMessage: Message = { 
        role: 'assistant', 
        content: data.response 
      };
      setMessages(prev => [...prev, aiMessage]);

      return data;
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, sendMessage, isLoading };
}
```

### JavaScript/Fetch Integration

```javascript
// Simple chat client
class ChatClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.history = [];
  }

  async chat(message) {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: this.history
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const data = await response.json();
    
    // Update history
    this.history.push({ role: 'user', content: message });
    this.history.push({ role: 'model', content: data.response });

    return data;
  }

  async searchPlaces(query, type) {
    const response = await fetch(`${this.baseURL}/api/places`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, type })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    return await response.json();
  }

  clearHistory() {
    this.history = [];
  }
}

// Usage
const client = new ChatClient();
const result = await client.chat('Find restaurants in Jakarta');
console.log(result.response);

if (result.locationAction) {
  const places = await client.searchPlaces(
    result.locationAction.query,
    result.locationAction.type
  );
  console.log(`Found ${places.count} places`);
}
```

---

## Webhook/Callback Support

Currently not implemented. Future versions may include:
- Webhook notifications for long-running searches
- Callback URLs for async processing
- Server-sent events for streaming responses

---

## API Versioning

Current version: `v1` (implicit)

Future versions will be accessible via:
- `/api/v2/chat`
- `/api/v2/places`

Version 1 will remain supported for backward compatibility.

---

## Support & Resources

- **Documentation**: See README.md, SECURITY.md, WORKFLOW.md
- **Google AI Studio**: https://makersuite.google.com/
- **Google Maps Platform**: https://developers.google.com/maps
- **Rate Limit Issues**: Adjust `RATE_LIMIT_MAX_REQUESTS` in `.env.local`
- **API Issues**: Check logs in terminal for detailed error messages

---

**Last Updated**: October 26, 2025
