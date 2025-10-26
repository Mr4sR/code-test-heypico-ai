'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface Place {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  rating?: number;
  userRatingsTotal?: number;
  photoReference?: string | null;
  types?: string[];
}

interface MapDisplayProps {
  places: Place[];
  userLocation?: { lat: number; lng: number } | null;
}

export default function MapDisplay({ places, userLocation }: MapDisplayProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitializing = useRef(false);
  const googleMapsLoaded = useRef(false);
  const hasInitialized = useRef(false);
  const currentInfoWindow = useRef<google.maps.InfoWindow | null>(null);

  console.log('MapDisplay render - isLoading:', isLoading, 'hasMap:', !!map, 'error:', error);

  // Callback ref - fires when element is attached/detached from DOM
  const setMapRef = (element: HTMLDivElement | null) => {
    console.log('setMapRef called with element:', !!element, 'map:', !!map, 'isInit:', isInitializing.current, 'hasInit:', hasInitialized.current);
    
    // Prevent re-initialization if already done
    if (!element || map || isInitializing.current || hasInitialized.current) return;
    
    mapContainerRef.current = element;
    isInitializing.current = true;
    hasInitialized.current = true;

    console.log('Map container attached to DOM, initializing...');

    // Run async initialization
    (async () => {
      try {
        // Fetch API key from backend
        const response = await fetch('/api/maps-key');
        if (!response.ok) {
          throw new Error('Failed to load map API key');
        }

        const { apiKey } = await response.json();
        console.log('API key received');

        // Load Google Maps only once
        if (!googleMapsLoaded.current) {
          console.log('Loading Google Maps SDK...');
          const loader = new Loader({
            apiKey,
            version: 'weekly',
            libraries: ['places', 'marker'],
          });

          await loader.load();
          googleMapsLoaded.current = true;
          console.log('Google Maps SDK loaded successfully');
        }

        // Verify element still exists
        if (!mapContainerRef.current) {
          throw new Error('Map container was removed during initialization');
        }

        // Default center to Jakarta
        const defaultCenter = { lat: -6.2088, lng: 106.8456 };

        console.log('Creating map instance...');
        
        // Create map
        const mapInstance = new google.maps.Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 13,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });

        console.log('Map created successfully');
        setMap(mapInstance);
        
        // Initialize DirectionsRenderer for showing routes
        const renderer = new google.maps.DirectionsRenderer({
          map: mapInstance,
          suppressMarkers: false, // Keep place markers visible
          polylineOptions: {
            strokeColor: '#7c3aed',
            strokeWeight: 4,
            strokeOpacity: 0.8,
          },
        });
        setDirectionsRenderer(renderer);
        
        setIsLoading(false);
      } catch (err: any) {
        console.error('Map initialization error:', err);
        setError(err.message || 'Failed to load map');
        setIsLoading(false);
      } finally {
        isInitializing.current = false;
      }
    })();
  };

  // Update markers when places change
  useEffect(() => {
    if (!map) {
      console.log('Map not ready yet, skipping marker update');
      return;
    }

    console.log('Updating markers for', places.length, 'places');

    // Clear existing markers and close any open info windows
    if (currentInfoWindow.current) {
      currentInfoWindow.current.close();
      currentInfoWindow.current = null;
    }
    markers.forEach((marker) => marker.setMap(null));
    
    const newMarkersList: google.maps.Marker[] = [];

    // Add user location marker if available
    if (userLocation) {
      const userMarker = new google.maps.Marker({
        position: userLocation,
        map,
        title: 'Your Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 1000,
      });
      newMarkersList.push(userMarker);
    }

    // Filter out places with invalid coordinates
    const validPlaces = places.filter(place => 
      place.location && 
      typeof place.location.lat === 'number' && 
      typeof place.location.lng === 'number' &&
      !isNaN(place.location.lat) && 
      !isNaN(place.location.lng) &&
      place.location.lat !== 0 &&
      place.location.lng !== 0
    );

    console.log('Valid places:', validPlaces.length);

    if (validPlaces.length === 0) {
      console.warn('No valid place coordinates found');
      setMarkers([]);
      return;
    }

    // Create new markers
    const newMarkers = validPlaces.map((place, index) => {
      console.log(`Creating marker ${index + 1}:`, place.name, place.location);
      
      const marker = new google.maps.Marker({
        position: place.location,
        map,
        title: place.name,
        label: {
          text: String(index + 1),
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
        },
        animation: google.maps.Animation.DROP,
      });

      // Build info window with photo (via server proxy) and neon-styled action icons
      const photoHtml = place.photoReference
        ? `<div style="width:100%;height:120px;overflow:hidden;border-radius:8px;margin-bottom:8px;background:#111"><img src=\"/api/place-photo?ref=${encodeURIComponent(
            place.photoReference
          )}&maxwidth=400\" style=\"width:100%;height:100%;object-fit:cover;display:block;\" alt=\"${place.name}\"/> </div>`
        : '';

      const originParam = (window && (window as any).userLocationForGMaps) || '';

      // Prefer opening the place details using the place id + name so Google Maps shows place information
      const mapsQuery = place.id
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(
            place.id
          )}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${place.location.lat},${place.location.lng}`
          )}`;

      const directionsUrl = (userLocation: any) =>
        `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
          `${userLocation.lat},${userLocation.lng}`
        )}&destination=${encodeURIComponent(`${place.location.lat},${place.location.lng}`)}&travelmode=driving`;

      // Use provided userLocation prop if available to build directions link
      const origin = (typeof window !== 'undefined' && (userLocation as any)) ? userLocation : null;

      const directionsLink = origin
        ? directionsUrl(origin)
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            `${place.location.lat},${place.location.lng}`
          )}`;

      const infoHtml = `
        <div style="padding:10px;max-width:320px;color:#e6e6f0;background:linear-gradient(135deg,#0f1724, #07030b);border-radius:12px;font-family:Arial,Helvetica,sans-serif;">
          ${photoHtml}
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:700;color:#fff;font-size:15px;margin-bottom:2px;">${place.name}</div>
            <div style="font-size:12px;color:#bfc7ff;">${place.address}</div>
            ${place.rating ? `<div style=\"font-size:12px;color:#ffd56b;\">★ ${place.rating} (${place.userRatingsTotal || 0})</div>` : ''}
            <div style="display:flex;gap:10px;margin-top:8px;align-items:center;">
              <a href=\"${mapsQuery}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:linear-gradient(135deg,#5b21b6,#06b6d4);box-shadow:0 6px 16px rgba(96,165,250,0.12);text-decoration:none;\" title=\"Open in Google Maps\"> 
                <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2L15 8l6 1-4.5 4L18 21l-6-3-6 3 1.5-7L2 9l6-1 3-6z\" fill=\"white\"/></svg>
                <span style=\"color:#fff;font-weight:600;font-size:13px;\">Open</span>
              </a>
              <a href=\"${directionsLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#7c3aed);box-shadow:0 6px 16px rgba(124,58,237,0.12);text-decoration:none;\" title=\"Start route in Google Maps\"> 
                <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 1118 0z\" fill=\"white\"/></svg>
                <span style=\"color:#fff;font-weight:600;font-size:13px;\">Route</span>
              </a>
              <a href=\"${directionsLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#06b6d4);box-shadow:0 6px 16px rgba(6,182,212,0.12);text-decoration:none;\" title=\"View route\"> 
                <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 11l4-4 4 4-4 4-4-4zm7 0h11v2H10v-2z\" fill=\"white\"/></svg>
                <span style=\"color:#fff;font-weight:600;font-size:13px;\">View</span>
              </a>
            </div>
          </div>
        </div>
      `;

      const infoWindow = new google.maps.InfoWindow({ content: infoHtml });

      marker.addListener('click', () => {
        // Close previous info window if open
        if (currentInfoWindow.current) {
          currentInfoWindow.current.close();
        }
        
        // Open new info window
        infoWindow.open(map, marker);
        currentInfoWindow.current = infoWindow;
        
        // Show route from user location to this place
        if (userLocation && directionsRenderer) {
          const directionsService = new google.maps.DirectionsService();
          
          directionsService.route(
            {
              origin: new google.maps.LatLng(userLocation.lat, userLocation.lng),
              destination: new google.maps.LatLng(place.location.lat, place.location.lng),
              travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
              if (status === google.maps.DirectionsStatus.OK && result) {
                directionsRenderer.setDirections(result);
                console.log('Route displayed from user to', place.name);
              } else {
                console.error('Directions request failed:', status);
                if (status === 'REQUEST_DENIED') {
                  console.error('❌ Directions API not enabled. Please enable it in Google Cloud Console.');
                  console.error('📖 See ENABLE_DIRECTIONS_API.md for instructions.');
                }
              }
            }
          );
        }
      });

      return marker;
    });

    // Combine user marker with place markers
    newMarkersList.push(...newMarkers);
    setMarkers(newMarkersList);

    // Fit bounds to show all markers
    if (validPlaces.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      
      // Include user location in bounds if available
      if (userLocation) {
        bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
      }
      
      validPlaces.forEach((place) => {
        bounds.extend(new google.maps.LatLng(place.location.lat, place.location.lng));
      });
      map.fitBounds(bounds);
      
      console.log('Map bounds fitted, showing', validPlaces.length, 'markers');
      
      // Add some padding after fitting bounds
      setTimeout(() => {
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 16) {
          map.setZoom(16);
          console.log('Zoom adjusted to 16');
        }
      }, 100);
    }
    
    console.log('Marker update complete');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, places, userLocation]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center px-4">
          <svg
            className="w-12 h-12 text-red-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Map Container - Always rendered so ref can attach */}
      <div 
        ref={setMapRef} 
        className="flex-1 w-full" 
        style={{ minHeight: '400px' }}
      />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Places List */}
      <div className="bg-gray-900 border-t border-purple-500/20 overflow-y-auto custom-scrollbar" style={{ maxHeight: '300px' }}>
        <div className="p-4">
          <h3 className="font-semibold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-3">
            Found {places.length} place{places.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-3">
            {places.map((place, index) => (
              <div
                key={place.id}
                className="p-3 bg-gray-800 border border-purple-500/20 rounded-lg hover:bg-gray-700 hover:border-purple-500/40 transition-all cursor-pointer shadow-lg shadow-purple-500/10"
                onClick={() => {
                  if (map) {
                    map.panTo(place.location);
                    map.setZoom(16);
                    // Trigger marker click (index + 1 because markers[0] is user location)
                    google.maps.event.trigger(markers[index + 1], 'click');
                  }
                }}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg shadow-purple-500/50">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-100 truncate">
                      {place.name}
                    </p>
                    <p className="text-sm text-gray-400 truncate">
                      {place.address}
                    </p>
                    {place.rating && (
                      <div className="flex items-center mt-1">
                        <span className="text-yellow-400 text-sm">★</span>
                        <span className="text-sm text-gray-300 ml-1">
                          {place.rating} ({place.userRatingsTotal || 0})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
