# API Security & Usage Limits - Quick Reference

## ✅ Security Measures Already Implemented

### 1. **API Key Protection** 🔐
```
✅ Keys stored in .env.local (never exposed to client)
✅ Server-side proxying (all API calls through Next.js routes)
✅ No keys in client-side code
✅ .env.local in .gitignore
```

### 2. **Rate Limiting** ⏱️
```
✅ Token bucket algorithm
✅ Default: 10 requests/minute per IP
✅ Automatic cleanup of old entries
✅ Rate limit headers in responses:
   - X-RateLimit-Limit
   - X-RateLimit-Remaining
   - X-RateLimit-Reset
```

**Current Limits:**
```typescript
/api/chat      → 10 requests/min (AI chat)
/api/places    → 10 requests/min (Place search)
/api/place-photo → 10 requests/min (Photos)
/api/maps-key  → 10 requests/min (Map key)
```

### 3. **Input Validation** ✔️
```
✅ Message length limits (max 1000 chars)
✅ HTML/script tag stripping
✅ Special character sanitization
✅ History array validation
✅ Coordinate validation
```

### 4. **Usage Tracking** 📊
```
✅ Daily request counters
✅ API key usage limits:
   - Gemini AI: 1,500 requests/day
   - Google Maps: 10,000 requests/day (adjustable)
✅ Automatic reset every 24 hours
```

### 5. **Audit Logging** 📝
```
✅ All requests logged
✅ Rate limit violations tracked
✅ Error logging with context
✅ Security events monitored
```

### 6. **Caching** 💾
```
✅ Place search results: 1 hour TTL
✅ Place photos: 24 hours browser cache
✅ Reduces redundant API calls
✅ Lower costs
```

### 7. **Security Headers** 🛡️
```
✅ X-Content-Type-Options: nosniff
✅ X-Frame-Options: DENY
✅ X-XSS-Protection: 1; mode=block
✅ Referrer-Policy: strict-origin-when-cross-origin
✅ Content-Security-Policy
✅ CORS headers (localhost only in dev)
```

### 8. **Error Handling** ⚠️
```
✅ No API keys in error messages
✅ Generic error messages to clients
✅ Detailed logging server-side
✅ Proper HTTP status codes
```

---

## ⚙️ Configuration Files

### Environment Variables (`.env.local`)
```bash
# API Keys (REQUIRED)
GOOGLE_AI_API_KEY=your_gemini_api_key_here
GOOGLE_MAPS_API_KEY=your_maps_api_key_here

# Rate Limiting (OPTIONAL - defaults shown)
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000
ENABLE_RATE_LIMITING=true

# Environment
NODE_ENV=development
```

### Security Middleware (`middleware.ts`)
- Location: `/middleware.ts`
- Applies to: All `/api/*` routes
- Features:
  - Security headers
  - CORS configuration
  - Request logging

### Rate Limiter (`lib/rateLimiter.ts`)
- Algorithm: Token bucket
- Features:
  - Per-IP limiting
  - Auto cleanup
  - Rate limit headers
  - Configurable limits

### API Key Manager (`lib/apiKeyManager.ts`)
- Usage tracking
- Daily limits
- Auto reset
- Key validation

### Input Validator (`lib/validation.ts`)
- Message sanitization
- Length limits
- Type checking
- XSS prevention

### Audit Logger (`lib/auditLogger.ts`)
- Request logging
- Security events
- Error tracking
- Performance metrics

---

## 🚨 Action Required: Google Cloud Console Setup

### Step 1: Restrict API Keys (CRITICAL!)

**Navigate to:**
https://console.cloud.google.com/apis/credentials

**For each API key:**

1. **Application Restrictions:**
   ```
   Select: HTTP referrers (websites)
   
   Add referrers:
   - http://localhost:3000/*
   - http://localhost:*/*
   - https://yourdomain.com/*
   - https://*.yourdomain.com/*
   ```

2. **API Restrictions:**
   ```
   Select: Restrict key
   
   Allow only:
   ✅ Maps JavaScript API
   ✅ Places API (New)
   ✅ Directions API ← ENABLE THIS!
   ✅ Geocoding API (optional)
   
   ❌ DO NOT allow all APIs
   ```

### Step 2: Set Usage Quotas

**Navigate to:**
https://console.cloud.google.com/apis/dashboard

**Set limits for each API:**

**Maps JavaScript API:**
```
Requests per day: 1,000 (increase as needed)
Requests per 100 seconds: 1,000
```

**Places API (New):**
```
Requests per day: 1,000
Requests per minute: 30
```

**Directions API:** ⚠️ **NOT ENABLED YET**
```
1. Search for "Directions API"
2. Click "ENABLE"
3. Set limits:
   - Requests per day: 500
   - Requests per minute: 30
```

### Step 3: Enable Billing Alerts

**Navigate to:**
https://console.cloud.google.com/billing

**Create budget:**
```
Name: Google Maps API Budget
Amount: $50/month
Alert at: 50%, 90%, 100%
Email notifications: ✅ Enabled
```

---

## 💰 Cost Monitoring

### Current Free Tier (2025)
```
Google AI (Gemini):
  ✅ 1,500 requests/day - FREE
  ✅ 15 requests/minute - FREE

Google Maps Platform:
  💰 $200 free credit/month
  After: Pay as you go
```

### Pricing (After Free Credit)
```
Maps JavaScript API:   $7 / 1,000 map loads
Places API (New):     $17 / 1,000 requests
Directions API:        $5 / 1,000 requests
Place Photos:          $7 / 1,000 requests
```

### Monitor Usage
**Real-time:**
```bash
# Development console
npm run dev

# Watch for:
- Rate limit warnings
- API usage counts
- Error patterns
```

**Google Cloud Console:**
```
Dashboard: https://console.cloud.google.com/apis/dashboard
View: Requests/day, errors, latency
Export: Logs for detailed analysis
```

---

## 🔧 Adjusting Limits

### Increase Rate Limits
**Method 1: Environment Variables**
```bash
# .env.local
RATE_LIMIT_MAX_REQUESTS=20
RATE_LIMIT_WINDOW_MS=60000
```

**Method 2: Code**
```typescript
// lib/rateLimiter.ts
export const aiChatLimiter = new RateLimiter(20, 60000); // 20/min
export const mapsLimiter = new RateLimiter(30, 60000);   // 30/min
```

### Increase Daily Limits
```typescript
// lib/apiKeyManager.ts
this.googleMapsKey = {
  key: mapsKey,
  usageCount: 0,
  dailyLimit: 20000, // Increase from 10,000
  lastReset: new Date(),
};
```

### Disable Rate Limiting (NOT RECOMMENDED)
```bash
# .env.local
ENABLE_RATE_LIMITING=false
```

---

## 🧪 Testing Security

### Test Rate Limiting
```javascript
// Make rapid requests in browser console
for (let i = 0; i < 15; i++) {
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'test' })
  }).then(r => console.log(i, r.status));
}
// Expected: First 10 succeed (200), next 5 fail (429)
```

### Test Input Validation
```javascript
// Test XSS prevention
fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    message: '<script>alert("xss")</script>' 
  })
}).then(r => r.json()).then(console.log);
// Expected: Script tags removed
```

### Test API Key Protection
```javascript
// Try to access env variables
console.log(process.env.GOOGLE_MAPS_API_KEY);
// Expected: undefined (keys not exposed to client)
```

---

## 📋 Security Checklist

### Before Production:
- [ ] All API keys set in `.env.local`
- [ ] `.env.local` in `.gitignore`
- [ ] API keys restricted in Google Cloud Console
- [ ] HTTP referrers configured
- [ ] API restrictions enabled
- [ ] Usage quotas set
- [ ] Billing alerts configured
- [ ] Directions API enabled
- [ ] Test with production domain
- [ ] Monitor usage for 24 hours

### Regular Maintenance:
- [ ] Review logs weekly
- [ ] Check billing monthly
- [ ] Rotate API keys quarterly
- [ ] Update dependencies
- [ ] Audit security settings
- [ ] Test rate limiting
- [ ] Review error patterns

---

## 🆘 Emergency Procedures

### If API Key Compromised:
```
1. Delete key immediately in Google Cloud Console
2. Generate new key
3. Update .env.local with new key
4. Restart application: npm run dev
5. Review billing for unauthorized usage
6. File support ticket if needed
```

### If Unexpected Charges:
```
1. Check usage: console.cloud.google.com/apis/dashboard
2. Disable affected APIs temporarily
3. Review audit logs: grep "API" logs/*.log
4. Increase restrictions
5. Contact Google Cloud Support
```

### If Rate Limit Too Strict:
```
1. Check logs for legitimate usage patterns
2. Adjust limits in .env.local or code
3. Consider different limits per endpoint
4. Monitor for abuse patterns
5. Implement authentication for higher limits
```

---

## 📚 Documentation References

### Internal Docs:
- `SECURITY_CONFIGURATION.md` - Detailed security guide
- `ENABLE_DIRECTIONS_API.md` - API enablement guide
- `SECURITY.md` - General security policy
- `SETUP.md` - Initial setup instructions

### External Resources:
- [Google Maps API Security](https://developers.google.com/maps/api-security-best-practices)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [API Key Security](https://cloud.google.com/docs/authentication/api-keys)
- [Google Cloud Billing](https://cloud.google.com/billing/docs)

---

## 🎯 Current Status

### ✅ Implemented & Active:
- Server-side API proxying
- Rate limiting (10 req/min)
- Input validation & sanitization
- Audit logging
- Usage tracking
- Caching (1hr places, 24hr photos)
- Security headers
- Error handling

### ⚠️ Action Required:
- **Restrict API keys** in Google Cloud Console
- **Enable Directions API**
- **Set usage quotas**
- **Configure billing alerts**
- **Add production domain** to HTTP referrers

### 🔄 Recommended Next Steps:
- Implement user authentication (JWT/OAuth)
- Add session-based rate limiting
- Set up monitoring dashboard
- Configure log aggregation
- Enable Cloud Armor (DDoS protection)
- Add API response caching layer

---

**Last Updated:** October 26, 2025  
**Next Review:** Weekly security audit recommended
