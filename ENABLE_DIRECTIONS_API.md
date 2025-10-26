# Enable Google Directions API

## Error Description
You're seeing this error:
```
Directions Service: You're calling a legacy API, which is not enabled for your project.
MapsRequestError: DIRECTIONS_ROUTE: REQUEST_DENIED
```

This means the **Directions API** is not enabled in your Google Cloud Console.

## Solution: Enable Directions API

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Select your project (or create a new one if you haven't)

### Step 2: Enable Directions API
1. Go to **APIs & Services** > **Library**
   - Direct link: https://console.cloud.google.com/apis/library

2. Search for "**Directions API**"

3. Click on "**Directions API**" from the results

4. Click the "**ENABLE**" button

### Step 3: Verify Required APIs
Make sure ALL these APIs are enabled for your project:

✅ **Maps JavaScript API** - For map display
✅ **Places API (New)** - For place search and photos  
✅ **Directions API** - For route calculation and display

### Step 4: Check API Key Restrictions (Optional but Recommended)

1. Go to **APIs & Services** > **Credentials**
2. Click on your API key
3. Under "API restrictions", select "Restrict key"
4. Add these APIs to the allowed list:
   - Maps JavaScript API
   - Places API (New)
   - Directions API

### Alternative: Use Routes API (New) - Modern Approach

If you want to use the newer Routes API instead:

1. Enable "**Routes API**" in the API Library
2. Update the code to use Routes API instead of Directions API

**Note:** Routes API has different pricing and may have more features, but requires code changes.

## Current Implementation

The app currently uses:
- `google.maps.DirectionsService` - Legacy Directions API
- `google.maps.DirectionsRenderer` - Renders route polyline on map

These features show:
- Driving route from user location to selected place
- Purple polyline with route path
- Turn-by-turn directions

## After Enabling

Once you enable the Directions API:
1. Refresh your browser
2. Click on any place marker
3. The route will display from your location to the selected place

## Pricing Information

**Directions API** pricing (as of 2025):
- $5.00 per 1,000 requests
- First $200 of usage free each month

Check latest pricing: https://developers.google.com/maps/billing/gmp-billing#directions

## Troubleshooting

If the error persists after enabling:
1. Wait 1-2 minutes for API to propagate
2. Clear browser cache and refresh
3. Check API key restrictions aren't blocking the API
4. Verify billing is enabled on your Google Cloud project

## Support Links

- [Directions API Documentation](https://developers.google.com/maps/documentation/directions/overview)
- [Routes API (New) Documentation](https://developers.google.com/maps/documentation/routes/overview)
- [Google Maps Platform Migration Guide](https://developers.google.com/maps/legacy)
