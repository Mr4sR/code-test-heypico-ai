# Security Implementation Guide

## Overview
This document outlines the security best practices implemented in this AI Chat application with Google Maps integration. Each measure is designed to protect against common vulnerabilities and ensure secure API usage.

## 🔐 1. API Key Security

### Server-Side Only Architecture
**Implementation**: All API keys are stored server-side in environment variables and never exposed to the client.

```typescript
// ❌ WRONG - Never do this
const apiKey = "AIzaSy..."; // Hardcoded
<script src=`https://maps.googleapis.com/maps/api/js?key=${apiKey}`>

// ✅ CORRECT - Server-side only
// lib/apiKeyManager.ts
const apiKey = process.env.GOOGLE_AI_API_KEY;
```

### API Key Manager
**File**: `lib/apiKeyManager.ts`

**Features**:
- Centralized key management
- Usage tracking per service
- Daily quota limits
- Automatic counter reset
- Error handling for missing keys

**How it works**:
```typescript
// Get API key with automatic usage tracking
const apiKey = apiKeyManager.getGoogleAiKey();
if (!apiKey) {
  // Quota exceeded or key not configured
  return error response
}

// Check usage stats
const stats = apiKeyManager.getUsageStats();
// Returns: { count, limit, remaining }
```

### Environment Variable Protection
**Best Practices**:
1. Never commit `.env.local` to version control
2. Use different keys for development and production
3. Rotate keys periodically
4. Monitor key usage in Google Cloud Console

```bash
# .gitignore includes
.env*.local
.env
```

## 🚦 2. Rate Limiting

### Token Bucket Algorithm
**File**: `lib/rateLimiter.ts`

**Why Token Bucket?**
- Allows brief bursts while maintaining average rate
- More flexible than fixed window
- Prevents abuse while allowing legitimate use

**Implementation**:
```typescript
// Create rate limiter
const limiter = new RateLimiter(
  maxRequests: 10,    // 10 requests
  windowMs: 60000     // per 60 seconds
);

// Check rate limit
const result = limiter.check(clientId);
if (!result.allowed) {
  return 429 error with retry time
}
```

### Client Identification
**Method**: IP Address + User-Agent combination
- More reliable than IP alone (NAT, proxies)
- Can't be easily bypassed
- Privacy-friendly (no tracking)

```typescript
function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return `${ip}:${userAgent.substring(0, 50)}`;
}
```

### Rate Limit Response Headers
**Standard**: RFC 6585
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1698765432000
```

### Automatic Cleanup
**Purpose**: Prevent memory leaks
```typescript
// Cleanup old entries every 5 minutes
setInterval(() => {
  aiChatLimiter.cleanup();
  mapsLimiter.cleanup();
}, 300000);
```

## ✅ 3. Input Validation

### Multi-Layer Validation
**File**: `lib/validation.ts`

#### Layer 1: Type Checking
```typescript
if (typeof message !== 'string') {
  return { valid: false, error: 'Message must be a string' };
}
```

#### Layer 2: Sanitization
```typescript
function sanitizeInput(input: string): string {
  return input
    .trim()                          // Remove whitespace
    .replace(/[<>]/g, '')            // Remove HTML tags
    .substring(0, 5000);             // Length limit
}
```

#### Layer 3: Length Limits
- **Message**: Max 5000 characters (prevents DoS)
- **Query**: Max 200 characters (reasonable for search)
- **History**: Max 50 messages (prevents memory issues)

#### Layer 4: Structure Validation
```typescript
// Validate conversation history
for (const msg of history) {
  if (!msg.role || !msg.content) {
    return { valid: false, error: 'Invalid message format' };
  }
  if (!['user', 'model'].includes(msg.role)) {
    return { valid: false, error: 'Invalid role' };
  }
}
```

### XSS Prevention
**Attack Vector**: User input with malicious HTML/JavaScript
```html
<!-- Attacker input -->
<script>alert('XSS')</script>
<img src=x onerror="alert('XSS')">
```

**Protection**:
```typescript
// Remove all < and > characters
input.replace(/[<>]/g, '')

// Result: scriptalert('XSS')/script
// Safe - no code execution
```

### SQL Injection Prevention
**Status**: Not applicable (no database)
**Future**: When adding database, use parameterized queries

## 📊 4. Audit Logging

### Log Levels
**File**: `lib/auditLogger.ts`

```typescript
enum LogLevel {
  INFO = 'INFO',           // Normal operations
  WARN = 'WARN',           // Potential issues
  ERROR = 'ERROR',         // Errors
  SECURITY = 'SECURITY'    // Security events
}
```

### What We Log

#### INFO Events
- API request success
- Cache hits/misses
- Usage statistics
- Performance metrics

```typescript
auditLogger.info('AI chat request successful', {
  clientId,
  messageLength: 150,
  responseLength: 450,
  duration: 1234
}, clientId);
```

#### WARN Events
- Rate limit approaching
- Invalid input attempts
- Unusual patterns

```typescript
auditLogger.warn('Invalid message format', {
  clientId,
  error: 'Message too long'
}, clientId);
```

#### ERROR Events
- API failures
- Configuration errors
- Unexpected exceptions

```typescript
auditLogger.error('API key unavailable', {
  service: 'Google AI',
  clientId
}, clientId);
```

#### SECURITY Events
- Rate limit violations
- Suspicious activity
- Authentication failures (future)

```typescript
auditLogger.security('Multiple rate limit violations', {
  clientId,
  violations: 5
}, clientId);
```

### Log Structure
```typescript
interface LogEntry {
  timestamp: string;        // ISO 8601 format
  level: LogLevel;
  event: string;
  details: Record<string, any>;
  clientId?: string;
}
```

### Production Integration
**Current**: In-memory storage (development)
**Production**: Integrate with:
- AWS CloudWatch
- Google Cloud Logging
- Datadog
- LogRocket
- Sentry

```typescript
// Production example
if (process.env.NODE_ENV === 'production') {
  // Send to CloudWatch
  await cloudwatch.putLogEvents({
    logGroupName: 'ai-chat-app',
    logStreamName: 'api-requests',
    logEvents: [entry]
  });
}
```

## 💾 5. Response Caching

### Cache Strategy
**File**: `lib/cache.ts`

**Purpose**:
- Reduce API calls (save costs)
- Improve response time
- Reduce server load

### Cache Implementation
```typescript
class Cache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private defaultTTL: number;
  
  set(key: string, data: T, ttl?: number): void
  get(key: string): T | null
  has(key: string): boolean
  cleanup(): void
}
```

### TTL Configuration
```typescript
// Place searches: 1 hour (data changes slowly)
export const placesCache = new Cache<any>(3600000);

// Geocoding: 24 hours (coordinates don't change)
export const geocodeCache = new Cache<any>(86400000);
```

### Cache Key Generation
**Pattern**: `service:query:params`
```typescript
const cacheKey = `places:${query}:${location}:${type}`;
// Example: "places:restaurants in Jakarta::restaurant"
```

### Cache Hit/Miss Tracking
```typescript
const cachedData = placesCache.get(cacheKey);
if (cachedData) {
  auditLogger.info('Cache hit', { cacheKey });
  return { ...cachedData, cached: true };
}

// Cache miss - fetch from API
const data = await fetchFromAPI();
placesCache.set(cacheKey, data);
return { ...data, cached: false };
```

### Cost Savings
**Example Calculation**:
- Places API: $17 per 1000 requests
- Cache hit rate: 80%
- Without cache: 1000 requests = $17
- With cache: 200 requests = $3.40
- **Savings: $13.60 per 1000 requests (80%)**

## 🔄 6. Error Handling

### HTTP Status Codes
**Standard**: RFC 7231

```typescript
// 400 - Bad Request (invalid input)
return NextResponse.json(
  { error: 'Message is required' },
  { status: 400 }
);

// 429 - Too Many Requests (rate limit)
return NextResponse.json(
  { error: 'Too many requests', resetAt: '...' },
  { status: 429 }
);

// 500 - Internal Server Error
return NextResponse.json(
  { error: 'An error occurred' },
  { status: 500 }
);

// 503 - Service Unavailable (quota exceeded)
return NextResponse.json(
  { error: 'Service temporarily unavailable' },
  { status: 503 }
);
```

### Error Information Disclosure
**Security Principle**: Don't expose internal details

```typescript
// ❌ WRONG - Exposes internal details
catch (error) {
  return { error: error.message }; // Might leak stack trace, paths
}

// ✅ CORRECT - Generic message to user, detailed log
catch (error: any) {
  auditLogger.error('API error', { 
    error: error.message, 
    stack: error.stack 
  });
  return { error: 'An error occurred. Please try again.' };
}
```

### Graceful Degradation
```typescript
// AI service unavailable? Inform user gracefully
if (!apiKey) {
  return {
    error: 'AI service temporarily unavailable. Please try again later.',
    status: 503
  };
}
```

## 🛡️ 7. API Endpoint Security

### Chat Endpoint (`/api/chat`)

**Security Measures**:
1. ✅ Rate limiting check
2. ✅ Input validation (message + history)
3. ✅ Sanitization (XSS prevention)
4. ✅ Content filtering (Google's safety settings)
5. ✅ Usage quota enforcement
6. ✅ Error handling (no detail leakage)
7. ✅ Audit logging

**Safety Settings**:
```typescript
const safetySettings = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
];
```

### Places Endpoint (`/api/places`)

**Security Measures**:
1. ✅ Rate limiting
2. ✅ Input validation
3. ✅ Response caching (1 hour)
4. ✅ Result limit (max 10 places)
5. ✅ Usage tracking
6. ✅ Error handling
7. ✅ Audit logging

### Maps Key Endpoint (`/api/maps-key`)

**Special Considerations**:
This endpoint returns an API key, but it's safe because:

1. **API Key Restrictions** (Set in Google Cloud Console):
   ```
   Application Restrictions:
   - HTTP referrers only
   - Allowed referrers: https://yourdomain.com/*
   
   API Restrictions:
   - Maps JavaScript API ONLY
   ```

2. **Rate Limiting**: Prevents automated key harvesting

3. **Purpose**: Key is ONLY for displaying maps, not for API calls

4. **Monitoring**: Usage tracked and logged

**Configuration Required**:
```
Google Cloud Console > Credentials > API Key > Edit
1. Application restrictions: HTTP referrers
2. Add: http://localhost:3000/* (development)
3. Add: https://yourdomain.com/* (production)
4. API restrictions: Select "Maps JavaScript API"
5. Save
```

## 📈 8. Usage Tracking & Quotas

### Daily Quota Management

**Google AI Studio (Gemini)**:
```typescript
dailyLimit: 1500  // Gemini free tier RPD
```

**Google Maps**:
```typescript
dailyLimit: 10000  // Adjust based on your plan
```

### Automatic Reset
```typescript
private resetIfNeeded(config: ApiKeyConfig): void {
  const now = new Date();
  const hoursSinceReset = (now.getTime() - config.lastReset.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceReset >= 24) {
    config.usageCount = 0;
    config.lastReset = now;
  }
}
```

### Usage Statistics
**Returned in API responses**:
```json
{
  "response": "...",
  "usage": {
    "count": 15,
    "limit": 1500,
    "remaining": 1485
  }
}
```

**Monitoring Dashboard** (Future):
- Real-time usage graphs
- Cost projections
- Alert thresholds
- Usage by endpoint

## 🔒 9. Production Checklist

### Before Deployment

- [ ] **Environment Variables**
  - [ ] Set production API keys
  - [ ] Use strong SESSION_SECRET
  - [ ] Set NEXT_PUBLIC_APP_URL to production domain

- [ ] **API Key Restrictions**
  - [ ] Add production domain to HTTP referrers
  - [ ] Verify API restrictions are set
  - [ ] Test key permissions

- [ ] **HTTPS/TLS**
  - [ ] Obtain SSL certificate
  - [ ] Configure HTTPS redirect
  - [ ] Enable HSTS headers

- [ ] **Rate Limiting**
  - [ ] Review and adjust limits for production traffic
  - [ ] Consider implementing Redis for distributed rate limiting

- [ ] **Monitoring**
  - [ ] Set up error tracking (Sentry)
  - [ ] Configure log aggregation (CloudWatch, Datadog)
  - [ ] Set up uptime monitoring
  - [ ] Create alerting rules

- [ ] **Security Headers**
  - [ ] Add CORS configuration
  - [ ] Implement CSP (Content Security Policy)
  - [ ] Add security headers (X-Frame-Options, etc.)

- [ ] **Database** (if adding)
  - [ ] Use connection pooling
  - [ ] Implement parameterized queries
  - [ ] Set up backup strategy

- [ ] **Authentication** (if adding)
  - [ ] Implement secure session management
  - [ ] Add CSRF protection
  - [ ] Use secure password hashing (bcrypt, Argon2)

### Security Headers to Add

```typescript
// next.config.mjs
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ]
  }
};
```

## 🧪 10. Security Testing

### Rate Limiting Test
```bash
# Test with curl
for i in {1..15}; do
  echo "Request $i"
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message":"Test"}' \
    -w "\nStatus: %{http_code}\n"
done
```

### Input Validation Test
```bash
# Test XSS prevention
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"<script>alert(1)</script>"}'

# Test length limit
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$(python3 -c 'print(\"A\"*10000)')\"}"
```

### API Key Security Test
```bash
# Verify keys not in client bundle
curl http://localhost:3000 | grep -i "AIza"
# Should return no results

# Check source code
curl http://localhost:3000/_next/static/* | grep -i "apikey"
# Should return no results
```

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [Next.js Security](https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables#bundling-environment-variables-for-the-browser)
- [Rate Limiting Best Practices](https://www.nginx.com/blog/rate-limiting-nginx/)

## 🔄 Security Updates

Stay informed about security updates:
1. Subscribe to Next.js security advisories
2. Monitor Google Cloud status dashboard
3. Review npm audit regularly: `npm audit`
4. Update dependencies: `npm update`

---

**Remember**: Security is an ongoing process, not a one-time implementation. Regular reviews and updates are essential.
