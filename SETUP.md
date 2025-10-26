# Quick Setup Guide

## Step 1: Install Dependencies

Open PowerShell in the project directory and run:

```powershell
npm install
```

## Step 2: Get Your API Keys

### Google AI Studio API Key (Gemini)
1. Visit: https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy the key (starts with `AIza...`)

### Google Maps API Key
1. Visit: https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Go to "APIs & Services" > "Library"
4. Enable these APIs:
   - Maps JavaScript API
   - Places API (New)
5. Go to "APIs & Services" > "Credentials"
6. Click "Create Credentials" > "API Key"
7. Copy the key

## Step 3: Restrict Your Google Maps API Key (IMPORTANT!)

### Create Two Separate Keys (Recommended)

#### Key 1: For Server-Side (Places API)
1. In Google Cloud Console > Credentials
2. Click on your API key
3. Under "API restrictions":
   - Select "Restrict key"
   - Choose "Places API (New)"
4. Under "Application restrictions":
   - Select "None" (or IP addresses for production)
5. Save

#### Key 2: For Client-Side (Maps Display)
1. Create another API key
2. Under "API restrictions":
   - Select "Restrict key"
   - Choose "Maps JavaScript API"
3. Under "Application restrictions":
   - Select "HTTP referrers"
   - Add: `http://localhost:3000/*`
   - Add: `http://localhost:*` (for other ports)
4. Save

**Note**: For this project, you can use the same key for both if properly restricted!

## Step 4: Configure Environment Variables

1. Copy the example file:
```powershell
Copy-Item .env.example .env.local
```

2. Open `.env.local` in your editor

3. Replace the placeholder values:
```env
# Google AI Studio API Key (from Step 2)
GOOGLE_AI_API_KEY=AIzaSy...your_actual_key_here

# Google Maps API Key (from Step 2)
GOOGLE_MAPS_API_KEY=AIzaSy...your_actual_key_here

# Leave these as default for now
NEXT_PUBLIC_APP_URL=http://localhost:3000
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000
ENABLE_AUDIT_LOG=true
ENABLE_RATE_LIMITING=true

# Generate a random string for this
SESSION_SECRET=your_random_secret_string_here
```

## Step 5: Run the Development Server

```powershell
npm run dev
```

The app will start at: http://localhost:3000

## Step 6: Test the Application

### Test 1: Basic Chat
1. Open http://localhost:3000 in your browser
2. Type: "Hello, how are you?"
3. Press Enter or click Send
4. You should get a response from the AI

### Test 2: Location Search
1. Type: "Find good restaurants in Jakarta"
2. The AI will respond and a map will appear
3. Click on markers to see place details
4. The places list will show below the map

### Test 3: Rate Limiting
1. Send 15 messages quickly
2. After 10 requests, you should see:
   - "Too many requests. Please try again later."
3. Wait 60 seconds and try again - it should work

## Troubleshooting

### Error: "Google AI API key unavailable"
**Solution**: 
- Check `.env.local` file exists
- Verify `GOOGLE_AI_API_KEY` is set correctly
- Restart the dev server: `Ctrl+C` then `npm run dev`

### Error: "Failed to load map"
**Solution**:
- Check `GOOGLE_MAPS_API_KEY` in `.env.local`
- Verify Maps JavaScript API is enabled in Google Cloud Console
- Check API key restrictions allow `http://localhost:3000/*`

### Error: "Too many requests"
**Solution**:
- This is normal - rate limiting is working!
- Wait 60 seconds
- Or increase `RATE_LIMIT_MAX_REQUESTS` in `.env.local`

### TypeScript Errors in Editor
**Solution**:
```powershell
# Install dependencies if not done already
npm install

# Wait for TypeScript to finish analyzing
# Errors should disappear after dependencies are installed
```

### Port 3000 Already in Use
**Solution**:
```powershell
# Use a different port
$env:PORT=3001; npm run dev
```

## Next Steps

### Customize Rate Limits
Edit `.env.local`:
```env
RATE_LIMIT_MAX_REQUESTS=20  # More requests
RATE_LIMIT_WINDOW_MS=60000  # Per 60 seconds
```

### Disable Rate Limiting (Development Only)
```env
ENABLE_RATE_LIMITING=false
```

### Adjust Cache Duration
Edit `lib/cache.ts`:
```typescript
// Change from 1 hour to 2 hours
export const placesCache = new Cache<any>(7200000);
```

### View Logs
Logs appear in the terminal where you ran `npm run dev`:
- `[INFO]` - Normal operations (cyan)
- `[WARN]` - Warnings (yellow)
- `[ERROR]` - Errors (red)
- `[SECURITY]` - Security events (magenta)

## Production Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Visit https://vercel.com
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Deploy!

### Environment Variables for Production
```env
GOOGLE_AI_API_KEY=your_production_key
GOOGLE_MAPS_API_KEY=your_production_key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
RATE_LIMIT_MAX_REQUESTS=20
ENABLE_RATE_LIMITING=true
ENABLE_AUDIT_LOG=true
```

### Update Google Maps API Key Restrictions
After deployment, add your production domain:
1. Google Cloud Console > Credentials
2. Edit your Maps API key
3. Under HTTP referrers, add:
   - `https://yourdomain.com/*`
   - `https://*.vercel.app/*` (if using Vercel)

## Support

For issues:
1. Check the README.md file
2. Review SECURITY.md for security details
3. Check Google Cloud Console for API quotas
4. Review terminal logs for error messages

---

**Enjoy your AI Chat with Maps! 🚀**
