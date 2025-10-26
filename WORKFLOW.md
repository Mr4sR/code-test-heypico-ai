# Workflow & Architecture Documentation

## 🏗️ System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ChatInterface Component                                │ │
│  │  - Message history                                      │ │
│  │  - Input handling                                       │ │
│  │  - State management                                     │ │
│  └────────────┬───────────────────────────┬────────────────┘ │
│               │                           │                   │
│               ▼                           ▼                   │
│  ┌──────────────────────┐   ┌──────────────────────┐        │
│  │  MessageBubble       │   │  MapDisplay          │        │
│  │  - Format messages   │   │  - Render map        │        │
│  │  - Markdown support  │   │  - Place markers     │        │
│  └──────────────────────┘   └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS Requests
                            │
┌─────────────────────────────────────────────────────────────┐
│                         SERVER SIDE                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │               API Routes (Next.js)                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ /api/chat    │  │ /api/places  │  │ /api/maps-key│ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │ │
│  │         │                  │                  │         │ │
│  │         ▼                  ▼                  ▼         │ │
│  │  ┌────────────────────────────────────────────────────┐│ │
│  │  │         Security & Utility Layer                    ││ │
│  │  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐   ││ │
│  │  │  │RateLimiter│  │Validation │  │ApiKeyManager │   ││ │
│  │  │  └──────────┘  └───────────┘  └──────────────┘   ││ │
│  │  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐   ││ │
│  │  │  │  Cache   │  │AuditLogger│  │Error Handler │   ││ │
│  │  │  └──────────┘  └───────────┘  └──────────────┘   ││ │
│  │  └────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    External API Calls
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
        ▼                                         ▼
┌──────────────────┐                    ┌──────────────────┐
│  Google AI Studio│                    │  Google Maps API │
│     (Gemini)     │                    │   (Places API)   │
└──────────────────┘                    └──────────────────┘
```

## 🔄 Request Flow

### 1. Chat Request Flow

```
User Types Message
    │
    ▼
ChatInterface.handleSendMessage()
    │
    ├─> Add user message to state
    ├─> Prepare conversation history
    │
    ▼
POST /api/chat
    │
    ├─> getClientIdentifier(req)
    ├─> aiChatLimiter.check(clientId)
    │   └─> ❌ Rate limit exceeded? → 429 Response
    │
    ├─> validateMessage(message)
    │   └─> ❌ Invalid? → 400 Response
    │
    ├─> validateHistory(history)
    │   └─> ❌ Invalid? → 400 Response
    │
    ├─> apiKeyManager.getGoogleAiKey()
    │   └─> ❌ Quota exceeded? → 503 Response
    │
    ├─> Log: auditLogger.info('Request started')
    │
    ▼
Call Google AI Studio API
    │
    ├─> Initialize GoogleGenerativeAI
    ├─> Create chat with history
    ├─> Send message with safety settings
    │
    ▼
Parse Response
    │
    ├─> Extract text response
    ├─> Look for JSON with action: "search_places"
    │   └─> ✅ Found? → locationAction object
    │
    ├─> Log: auditLogger.info('Request successful')
    │
    ▼
Return Response
    │
    ├─> response: AI text
    ├─> locationAction: search details (if any)
    ├─> usage: API usage stats
    │
    ▼
ChatInterface receives response
    │
    ├─> Add AI message to state
    ├─> locationAction present?
    │   └─> ✅ Yes → Call handlePlaceSearch()
    │
    ▼
Display message in UI
```

### 2. Place Search Flow

```
AI Triggers Location Action
    │
    ▼
ChatInterface.handlePlaceSearch(locationAction)
    │
    ▼
POST /api/places
    │
    ├─> getClientIdentifier(req)
    ├─> mapsLimiter.check(clientId)
    │   └─> ❌ Rate limit exceeded? → 429 Response
    │
    ├─> validateLocationQuery(query)
    │   └─> ❌ Invalid? → 400 Response
    │
    ├─> Create cache key: "places:{query}:{location}:{type}"
    │
    ├─> placesCache.get(cacheKey)
    │   └─> ✅ Cache hit? → Return cached data
    │
    ├─> apiKeyManager.getGoogleMapsKey()
    │   └─> ❌ Quota exceeded? → 503 Response
    │
    ├─> Log: auditLogger.info('Places search started')
    │
    ▼
Call Google Places API
    │
    ├─> Build query with parameters
    ├─> Fetch from Places API (Text Search)
    ├─> Check response status
    │   └─> ❌ OVER_QUERY_LIMIT? → 503 Response
    │
    ▼
Format & Cache Response
    │
    ├─> Extract top 10 results
    ├─> Format place data:
    │   ├─> id, name, address
    │   ├─> location (lat, lng)
    │   ├─> rating, reviews
    │   └─> photo reference
    │
    ├─> placesCache.set(cacheKey, data, 3600000)
    ├─> Log: auditLogger.info('Search successful')
    │
    ▼
Return Response
    │
    ├─> places: array of place objects
    ├─> count: number of results
    ├─> cached: boolean
    ├─> usage: API usage stats
    │
    ▼
ChatInterface receives places
    │
    ├─> setPlaces(places)
    ├─> setShowMap(true)
    │
    ▼
MapDisplay Component
    │
    ├─> Fetch Maps API key from /api/maps-key
    ├─> Load Google Maps JavaScript API
    ├─> Create map instance
    ├─> Add markers for each place
    ├─> Create info windows
    ├─> Fit bounds to show all markers
    │
    ▼
Display Interactive Map
```

### 3. Map Display Flow

```
MapDisplay Component Mounts
    │
    ▼
GET /api/maps-key
    │
    ├─> getClientIdentifier(req)
    ├─> mapsLimiter.check(clientId)
    │   └─> ❌ Rate limit exceeded? → 429 Response
    │
    ├─> Get GOOGLE_MAPS_API_KEY from env
    │   └─> ❌ Not configured? → 503 Response
    │
    ├─> Log: auditLogger.info('Maps key requested')
    │
    ▼
Return API Key
    │
    ▼
MapDisplay receives key
    │
    ├─> Initialize Loader from @googlemaps/js-api-loader
    ├─> Load Maps JavaScript API
    │   ├─> Libraries: ['places', 'marker']
    │   └─> Version: 'weekly'
    │
    ▼
Create Map Instance
    │
    ├─> Calculate bounds for all places
    ├─> Create google.maps.Map
    ├─> Configure controls:
    │   ├─> mapTypeControl: true
    │   ├─> streetViewControl: true
    │   └─> fullscreenControl: true
    │
    ├─> Fit map to bounds
    │
    ▼
Add Markers
    │
    ├─> For each place:
    │   ├─> Create google.maps.Marker
    │   ├─> Set position (lat, lng)
    │   ├─> Set label (number)
    │   ├─> Add animation (DROP)
    │   │
    │   ├─> Create InfoWindow
    │   │   ├─> Place name
    │   │   ├─> Address
    │   │   └─> Rating & reviews
    │   │
    │   └─> Add click listener
    │       └─> Open InfoWindow
    │
    ▼
Display Places List
    │
    ├─> Render scrollable list below map
    ├─> For each place:
    │   ├─> Show number badge
    │   ├─> Show name & address
    │   ├─> Show rating & reviews
    │   │
    │   └─> Add click handler
    │       ├─> Pan map to location
    │       ├─> Zoom to 16
    │       └─> Open marker's InfoWindow
    │
    ▼
Interactive Map Ready
```

## 🔐 Security Workflow

### Rate Limiting Workflow

```
Request Arrives
    │
    ▼
getClientIdentifier(req)
    │
    ├─> Extract x-forwarded-for header
    ├─> Extract x-real-ip header
    ├─> Fallback to connection IP
    ├─> Extract user-agent header
    │
    ▼
clientId = "IP:UserAgent"
    │
    ▼
rateLimiter.check(clientId)
    │
    ├─> Check if identifier exists in store
    │   └─> No? → Create new entry with max tokens
    │
    ├─> Calculate time since last refill
    ├─> Calculate refill amount
    │   └─> refillAmount = (timePassed / windowMs) * maxRequests
    │
    ├─> Refill tokens if needed
    │   └─> tokens = min(maxRequests, tokens + refillAmount)
    │
    ├─> Check if tokens available
    │   ├─> Yes? → Decrement token, allow request
    │   └─> No? → Deny request, return 429
    │
    ▼
Return { allowed, remaining, resetAt }
```

### Input Validation Workflow

```
User Input Received
    │
    ▼
validateMessage(message)
    │
    ├─> Type check: is string?
    │   └─> No? → { valid: false, error: "Message is required" }
    │
    ├─> Sanitize input:
    │   ├─> Trim whitespace
    │   ├─> Remove < and > characters (XSS prevention)
    │   └─> Limit to 5000 characters
    │
    ├─> Check if empty after sanitization
    │   └─> Yes? → { valid: false, error: "Message cannot be empty" }
    │
    ├─> Check length
    │   └─> > 5000? → { valid: false, error: "Message is too long" }
    │
    ▼
Return { valid: true }
```

### API Key Management Workflow

```
API Call Needed
    │
    ▼
apiKeyManager.getGoogleAiKey()
    │
    ├─> Check if key exists
    │   └─> No? → Log error, return null
    │
    ├─> Check if daily reset needed
    │   └─> Hours since last reset >= 24?
    │       └─> Yes? → Reset counter, update timestamp
    │
    ├─> Check usage against quota
    │   └─> usageCount >= dailyLimit?
    │       └─> Yes? → Log warning, return null
    │
    ├─> Increment usage counter
    ├─> Return API key
    │
    ▼
Use key for API call
```

### Caching Workflow

```
Places Request Arrives
    │
    ▼
Generate Cache Key
    │
    └─> "places:{query}:{location}:{type}"
    │
    ▼
placesCache.get(cacheKey)
    │
    ├─> Check if key exists
    │   └─> No? → Return null (cache miss)
    │
    ├─> Get entry with data and expiresAt
    │
    ├─> Check if expired
    │   └─> now > expiresAt?
    │       └─> Yes? → Delete entry, return null
    │
    ├─> Log cache hit
    │
    ▼
Return cached data
    │
    └─> { ...data, cached: true }

(If cache miss)
    │
    ▼
Fetch from API
    │
    ├─> Call Google Places API
    ├─> Format response
    │
    ▼
placesCache.set(cacheKey, data, ttl)
    │
    ├─> Create cache entry:
    │   ├─> data: response data
    │   ├─> timestamp: now
    │   └─> expiresAt: now + ttl (3600000ms = 1 hour)
    │
    ├─> Store in Map
    │
    ▼
Return fresh data
    │
    └─> { ...data, cached: false }
```

### Audit Logging Workflow

```
Event Occurs
    │
    ▼
auditLogger.info/warn/error/security(event, details, clientId)
    │
    ├─> Check if logging enabled
    │   └─> ENABLE_AUDIT_LOG !== 'true'? → Return early
    │
    ├─> Create log entry:
    │   ├─> timestamp: ISO 8601 format
    │   ├─> level: INFO/WARN/ERROR/SECURITY
    │   ├─> event: description string
    │   ├─> details: object with context
    │   └─> clientId: optional identifier
    │
    ├─> Console output (development):
    │   └─> Colored based on level
    │
    ├─> Store in memory:
    │   ├─> Add to logs array
    │   └─> Trim if > maxLogs (1000)
    │
    ├─> Production: Send to service
    │   └─> CloudWatch, Datadog, etc.
    │
    ▼
Log Entry Stored
```

## 📊 Data Flow Diagrams

### Message Data Flow

```
┌─────────────────┐
│  User Interface │
│  (ChatInterface)│
└────────┬────────┘
         │
         │ 1. User types message
         │
         ▼
    ┌─────────┐
    │ Message │───────┐
    │ Object  │       │ 2. Add to state
    └─────────┘       │
         │            │
         │ 3. POST    │
         ▼            │
┌──────────────────┐ │
│  /api/chat       │ │
│  - Rate limit    │ │
│  - Validate      │ │
│  - Call AI API   │ │
└────────┬─────────┘ │
         │            │
         │ 4. Response│
         ▼            │
┌──────────────────┐ │
│  AI Response     │ │
│  - text          │ │
│  - locationAction│ │
└────────┬─────────┘ │
         │            │
         │ 5. Add AI  │
         │    message │
         ▼            ▼
┌─────────────────────┐
│  Message State      │
│  [user, ai, user...] │
└──────────┬──────────┘
           │
           │ 6. Render
           ▼
┌───────────────────────┐
│  MessageBubble x N    │
│  - User messages      │
│  - AI messages        │
└───────────────────────┘
```

### Place Search Data Flow

```
┌──────────────┐
│ AI Response  │
│locationAction│
└──────┬───────┘
       │
       │ 1. Trigger
       ▼
┌──────────────────┐
│handlePlaceSearch │
└──────┬───────────┘
       │
       │ 2. POST
       ▼
┌──────────────────┐
│  /api/places     │
│  - Rate limit    │
│  - Check cache   │◄─────┐
│  - Validate      │      │
└──────┬───────────┘      │
       │                  │
       │ 3. Cache miss?   │ 5. Cache
       ▼                  │    result
┌──────────────────┐      │
│ Google Places API│      │
└──────┬───────────┘      │
       │                  │
       │ 4. Response      │
       ▼                  │
┌──────────────────┐      │
│  Format Places   │──────┘
│  - Top 10 results│
│  - Extract data  │
└──────┬───────────┘
       │
       │ 6. Return
       ▼
┌──────────────────┐
│  Places State    │
└──────┬───────────┘
       │
       │ 7. Pass as prop
       ▼
┌──────────────────┐
│   MapDisplay     │
│  - Load map      │
│  - Add markers   │
│  - Show list     │
└──────────────────┘
```

## 🛠️ Component Interaction

### ChatInterface ↔ MessageBubble

```typescript
// ChatInterface manages state
const [messages, setMessages] = useState<Message[]>([]);

// Renders each message
messages.map((message) => (
  <MessageBubble key={message.id} message={message} />
))

// MessageBubble receives props and renders
function MessageBubble({ message }: MessageBubbleProps) {
  // Format and display message
  // Handle user vs AI styling
  // Parse markdown for AI messages
}
```

### ChatInterface ↔ MapDisplay

```typescript
// ChatInterface manages places state
const [places, setPlaces] = useState<Place[]>([]);
const [showMap, setShowMap] = useState(false);

// When places found
if (data.places && data.places.length > 0) {
  setPlaces(data.places);  // Update state
  setShowMap(true);         // Show map
}

// Conditional render
{showMap && places.length > 0 && (
  <MapDisplay places={places} />
)}

// MapDisplay receives places and renders map
function MapDisplay({ places }: MapDisplayProps) {
  // Load Google Maps
  // Create markers for each place
  // Handle user interactions
}
```

## 🔄 State Management Strategy

### Local State (useState)
- **messages**: Conversation history
- **input**: Current input text
- **isLoading**: Loading state for API calls
- **places**: Search results from Places API
- **showMap**: Map visibility toggle

### Why No Global State Management?
- **Simplicity**: Single-page app with minimal state
- **Performance**: No prop drilling issues
- **Scalability**: Easy to add Redux/Zustand later if needed

### Future: Add Context for
- User authentication
- Theme preferences
- Global settings

## 📈 Performance Optimization

### 1. Response Caching
- **Impact**: 80% reduction in API calls
- **Method**: In-memory cache with TTL
- **Benefit**: Faster responses, lower costs

### 2. Rate Limiting
- **Impact**: Prevents API abuse
- **Method**: Token bucket algorithm
- **Benefit**: Protects from cost overruns

### 3. Component Optimization
```typescript
// MessageBubble: Pure component
// Only re-renders when message changes
React.memo(MessageBubble);

// MapDisplay: useEffect for map initialization
// Only runs once per mount
useEffect(() => {
  initMap();
}, []); // Empty dependency array
```

### 4. Lazy Loading
```typescript
// Future: Code splitting
const MapDisplay = lazy(() => import('./MapDisplay'));

// Load only when needed
{showMap && (
  <Suspense fallback={<LoadingMap />}>
    <MapDisplay places={places} />
  </Suspense>
)}
```

## 🧪 Testing Strategy

### Unit Tests (Future)
```typescript
// lib/rateLimiter.test.ts
describe('RateLimiter', () => {
  it('should allow requests under limit', () => {
    const limiter = new RateLimiter(10, 60000);
    const result = limiter.check('test-client');
    expect(result.allowed).toBe(true);
  });
  
  it('should deny requests over limit', () => {
    const limiter = new RateLimiter(1, 60000);
    limiter.check('test-client');
    const result = limiter.check('test-client');
    expect(result.allowed).toBe(false);
  });
});
```

### Integration Tests (Future)
```typescript
// app/api/chat/route.test.ts
describe('POST /api/chat', () => {
  it('should return AI response', async () => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBeDefined();
  });
});
```

### E2E Tests (Future)
```typescript
// Playwright or Cypress
test('User can chat with AI', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.fill('textarea', 'Hello');
  await page.click('button[type="submit"]');
  await expect(page.locator('.message-ai')).toBeVisible();
});
```

## 📦 Deployment Workflow

### 1. Pre-Deployment Checklist
- [ ] Set production environment variables
- [ ] Restrict Google Maps API keys
- [ ] Enable HTTPS
- [ ] Set up monitoring
- [ ] Test rate limiting
- [ ] Review security headers

### 2. Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Or push to GitHub and auto-deploy
git push origin main
```

### 3. Environment Variables
```env
# Add in Vercel Dashboard
GOOGLE_AI_API_KEY=prod_key
GOOGLE_MAPS_API_KEY=prod_key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 4. Post-Deployment
- Test all functionality
- Monitor logs
- Check API usage
- Set up alerts

---

## Summary

This architecture prioritizes:
1. **Security**: API keys server-side, rate limiting, validation
2. **Performance**: Caching, optimization, minimal re-renders
3. **Cost Management**: Usage quotas, caching, monitoring
4. **Maintainability**: Clear separation of concerns, comprehensive logging
5. **Scalability**: Easy to add features, databases, authentication

The workflow ensures every request is validated, rate-limited, logged, and handled securely before reaching external APIs.
