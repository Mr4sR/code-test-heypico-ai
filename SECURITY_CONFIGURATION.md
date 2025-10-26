# Security Configuration & Usage Limits Guide

## 🔒 Current Security Measures Implemented

### 1. API Key Protection

#### ✅ Server-Side Only Access
- **API keys NEVER exposed to client** - All keys stored in `.env.local`
- All Google API calls go through Next.js API routes (`/api/*`)
- Client-side code uses proxied endpoints

#### ✅ Environment Variables
```bash
# .env.local (NEVER commit to Git!)
GOOGLE_AI_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY=your_key_here
```

#### ✅ Protected Endpoints
- `/api/chat` - Gemini AI (proxied)
- `/api/places` - Places API (proxied)
- `/api/place-photo` - Photo API (proxied)
- `/api/maps-key` - Maps JS API key (for client-side map display)

---

## 🛡️ Usage Limits & Rate Limiting

### Current Rate Limits (Implemented)

**Per IP Address:**
- **10 requests per minute** (token bucket algorithm)
- Automatic refill: tokens restore every minute
- Prevents abuse and API cost overruns

**Daily Limits (Configured):**
- Gemini AI: **1,500 requests/day** (free tier)
- Google Maps: **10,000 requests/day** (adjustable)

### Rate Limiter Implementation
Location: `lib/rateLimiter.ts`
```typescript
// Applied to all API routes
const limiter = new RateLimiter(10, 60000); // 10 req/min
```

---

## 🔐 Required: Google Cloud Console Security Settings

### Step 1: Restrict API Keys

**For GOOGLE_MAPS_API_KEY:**

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your API key
3. Under "Application restrictions":
   - Select: **HTTP referrers (websites)**
   - Add allowed referrers:
     ```
     http://localhost:3000/*
     http://localhost:*/*
     https://yourdomain.com/*
     https://*.yourdomain.com/*
     ```

4. Under "API restrictions":
   - Select: **Restrict key**
   - Allow ONLY these APIs:
     - ✅ Maps JavaScript API
     - ✅ Places API (New)
     - ✅ Directions API
     - ✅ (Optional) Geocoding API
   - **DO NOT** allow all APIs!

**For GOOGLE_AI_API_KEY (Gemini):**

1. Go to: https://aistudio.google.com/app/apikey
2. Click on your API key settings
3. Set restrictions if available
4. Monitor usage regularly

### Step 2: Set Usage Quotas

1. Go to: https://console.cloud.google.com/apis/dashboard
2. Click on each enabled API
3. Go to **"Quotas & System Limits"**
4. Set custom limits:

**Recommended Limits:**
```
Maps JavaScript API:
  - Map loads: 1,000/day (increase as needed)
  - Requests per minute: 100

Places API (New):
  - Requests per day: 1,000
  - Requests per minute: 30

Directions API:
  - Requests per day: 500
  - Requests per minute: 30
```

### Step 3: Enable Billing Alerts

1. Go to: https://console.cloud.google.com/billing
2. Click "Budgets & alerts"
3. Create budget:
   - Name: "Google Maps API Budget"
   - Amount: $50/month (adjust based on your needs)
   - Alert thresholds: 50%, 90%, 100%
   - Email notifications: ✅ Enabled

---

## 📊 Cost Management

### Current Free Tier (2025)

**Google AI (Gemini):**
- ✅ Free: 1,500 requests/day
- ✅ 15 requests/minute
- ✅ Free for development & production

**Google Maps Platform:**
- 💰 $200 free credit/month
- After credit: Pay-as-you-go

**Estimated Costs (After Free Credit):**
```
Maps JavaScript API: $7 per 1,000 loads
Places API (New): $17 per 1,000 requests
Directions API: $5 per 1,000 requests
Place Photos: $7 per 1,000 requests
```

### Cost Optimization Tips

1. **Enable Caching** (Already Implemented ✅)
   - Place searches cached: 1 hour
   - Reduces duplicate API calls

2. **Rate Limiting** (Already Implemented ✅)
   - Prevents abuse
   - Controls costs automatically

3. **Field Masks** (Already Implemented ✅)
   - Only request needed data
   - Reduces billing units

4. **Monitor Usage Weekly**
   - Check: https://console.cloud.google.com/apis/dashboard
   - Review: API metrics and costs

---

## 🚨 Security Best Practices Checklist

### ✅ Already Implemented:
- [x] API keys in environment variables (`.env.local`)
- [x] Server-side API proxying (Next.js API routes)
- [x] Rate limiting (10 requests/min per IP)
- [x] Input validation (sanitization)
- [x] Audit logging (requests tracked)
- [x] Usage counters (daily limits)
- [x] Error handling (no key leaks in errors)
- [x] Caching (reduces redundant calls)
- [x] `.env.local` in `.gitignore`

### ⚠️ Required (Your Action):
- [ ] **Restrict API keys in Google Cloud Console** (Step 1 above)
- [ ] **Set usage quotas** (Step 2 above)
- [ ] **Enable billing alerts** (Step 3 above)
- [ ] **Enable Directions API** (see ENABLE_DIRECTIONS_API.md)
- [ ] **Test with restricted key** (verify still works)

### 🔒 Additional Recommendations:
- [ ] Implement authentication (OAuth, JWT) for production
- [ ] Add CORS headers to API routes
- [ ] Set up monitoring (e.g., Vercel Analytics)
- [ ] Regular security audits
- [ ] Rotate API keys quarterly
- [ ] Set up webhook alerts for unusual usage

---

## 🔍 Monitoring & Auditing

### View Audit Logs
Check server console for:
```
[INFO] API request logged: {endpoint, ip, timestamp, status}
[WARNING] Rate limit exceeded: {ip, remaining}
[ERROR] API error: {error, endpoint}
```

### Check Usage
**Real-time monitoring:**
```bash
# View logs in development
npm run dev

# Check console output for:
- Rate limit warnings
- API usage counts
- Error patterns
```

**Google Cloud Console:**
1. https://console.cloud.google.com/apis/dashboard
2. View graphs: requests/day, errors, latency
3. Export logs for analysis

---

## 🚦 Rate Limit Response

When rate limit is exceeded, API returns:
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "message": "Too many requests. Please try again in 60 seconds."
}
```

HTTP Status: `429 Too Many Requests`

Headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1730000000
```

---

## 🔧 Adjusting Limits

### Increase Rate Limits
Edit `lib/rateLimiter.ts`:
```typescript
// Increase from 10 to 20 requests/min
const limiter = new RateLimiter(20, 60000);
```

### Increase Daily Limits
Edit `lib/apiKeyManager.ts`:
```typescript
this.googleMapsKey = {
  key: mapsKey,
  usageCount: 0,
  dailyLimit: 20000, // Increase from 10,000
  lastReset: new Date(),
};
```

### Per-Endpoint Limits
Create different limiters:
```typescript
const chatLimiter = new RateLimiter(5, 60000);    // 5/min for AI
const mapsLimiter = new RateLimiter(30, 60000);   // 30/min for Maps
const placesLimiter = new RateLimiter(20, 60000); // 20/min for Places
```

---

## 📚 Security Documentation

### Related Files:
- `SECURITY.md` - General security guidelines
- `ENABLE_DIRECTIONS_API.md` - API setup guide
- `lib/rateLimiter.ts` - Rate limiting implementation
- `lib/apiKeyManager.ts` - API key management
- `lib/auditLogger.ts` - Request logging
- `lib/validation.ts` - Input sanitization

### External Resources:
- [Google Maps Platform Security](https://developers.google.com/maps/api-security-best-practices)
- [API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
- [Rate Limiting Strategies](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

---

## 🆘 Emergency Response

### If API Key Compromised:
1. **Immediately delete key** in Google Cloud Console
2. Generate new key
3. Update `.env.local`
4. Restart application: `npm run dev`
5. Review billing for unauthorized usage
6. Contact Google Cloud Support if needed

### If Unexpected Billing:
1. Check usage: https://console.cloud.google.com/apis/dashboard
2. Disable affected APIs temporarily
3. Review audit logs for abuse patterns
4. Increase rate limits/restrictions
5. Contact billing support

---

## ✅ Quick Security Verification

Run this checklist before deploying to production:

```bash
# 1. Check .env.local is NOT in Git
git status --ignored | grep .env.local

# 2. Verify API keys are set
cat .env.local | grep API_KEY

# 3. Test rate limiting
# Make 15 rapid requests - should see 429 errors

# 4. Check Google Cloud restrictions
# Visit: https://console.cloud.google.com/apis/credentials
# Verify: HTTP referrers and API restrictions are set

# 5. Verify billing alerts
# Visit: https://console.cloud.google.com/billing
# Ensure: Budget alerts are configured
```

---

## 📞 Support

For security concerns:
- **Google Cloud Support**: https://cloud.google.com/support
- **Google Maps Platform**: https://developers.google.com/maps/support
- **Security Issues**: Check `SECURITY.md` for reporting

---

**Last Updated**: October 26, 2025  
**Review Schedule**: Quarterly security audits recommended
