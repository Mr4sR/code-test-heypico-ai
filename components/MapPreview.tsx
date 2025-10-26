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

interface MapPreviewProps {
  places: Place[];
  onExpandMap: () => void;
  userLocation?: { lat: number; lng: number } | null;
}

export default function MapPreview({ places, onExpandMap, userLocation }: MapPreviewProps) {
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

  // Callback ref - fires when element is attached/detached from DOM
  const setMapRef = (element: HTMLDivElement | null) => {
    if (!element || map || isInitializing.current || hasInitialized.current) return;
    
    mapContainerRef.current = element;
    isInitializing.current = true;
    hasInitialized.current = true;

    // Run async initialization
    (async () => {
      try {
        // Fetch API key from backend
        const response = await fetch('/api/maps-key');
        if (!response.ok) {
          throw new Error('Failed to load map API key');
        }

        const { apiKey } = await response.json();

        // Load Google Maps only once
        if (!googleMapsLoaded.current) {
          const loader = new Loader({
            apiKey,
            version: 'weekly',
            libraries: ['places', 'marker'],
          });

          await loader.load();
          googleMapsLoaded.current = true;
        }

        // Verify element still exists
        if (!mapContainerRef.current) {
          throw new Error('Map container was removed during initialization');
        }

        // Calculate center from places
        const defaultCenter = places.length > 0 
          ? places[0].location 
          : { lat: -6.2088, lng: 106.8456 };

        // Create map
        const mapInstance = new google.maps.Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });

        setMap(mapInstance);
        
        // Initialize DirectionsRenderer for showing routes
        const renderer = new google.maps.DirectionsRenderer({
          map: mapInstance,
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: '#7c3aed',
            strokeWeight: 3,
            strokeOpacity: 0.7,
          },
        });
        setDirectionsRenderer(renderer);
        
        setIsLoading(false);
      } catch (err: any) {
        console.error('Map preview initialization error:', err);
        setError(err.message || 'Failed to load map');
        setIsLoading(false);
      } finally {
        isInitializing.current = false;
      }
    })();
  };

  // Update markers when places or map changes
  useEffect(() => {
    if (!map || places.length === 0) return;

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
          scale: 8,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        zIndex: 1000,
      });
      newMarkersList.push(userMarker);
    }

    // Filter valid places
    const validPlaces = places.filter(place => 
      place.location && 
      typeof place.location.lat === 'number' && 
      typeof place.location.lng === 'number' &&
      !isNaN(place.location.lat) && 
      !isNaN(place.location.lng) &&
      place.location.lat !== 0 &&
      place.location.lng !== 0
    );

    if (validPlaces.length === 0) return;

    // Create new markers
    const newMarkers = validPlaces.map((place, index) => {
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
      });

      const photoHtml = place.photoReference
        ? `<div style="width:100%;height:90px;overflow:hidden;border-radius:6px;margin-bottom:6px;background:#000"><img src=\"/api/place-photo?ref=${encodeURIComponent(
            place.photoReference
          )}&maxwidth=300\" style=\"width:100%;height:100%;object-fit:cover;display:block;\" alt=\"${place.name}\"/> </div>`
        : '';

      // Prefer opening the place details using place id and name so Maps shows place info
      const mapsQuery = place.id
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(
            place.id
          )}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${place.location.lat},${place.location.lng}`
          )}`;

      const directionsUrl = (loc: any) =>
        `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
          `${loc.lat},${loc.lng}`
        )}&destination=${encodeURIComponent(`${place.location.lat},${place.location.lng}`)}&travelmode=driving`;

      const origin = userLocation || null;
      const directionsLink = origin
        ? directionsUrl(origin)
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            `${place.location.lat},${place.location.lng}`
          )}`;

      const infoHtml = `
        <div style="padding:8px;max-width:260px;color:#e8e8ff;background:linear-gradient(135deg,#05060a,#0b0420);border-radius:10px;font-family:Arial,Helvetica,sans-serif;">
          ${photoHtml}
          <div style="font-weight:700;color:#fff;font-size:14px;margin-bottom:6px;">${place.name}</div>
          <div style="font-size:12px;color:#bfc7ff;margin-bottom:6px;">${place.address}</div>
          <div style="display:flex;gap:8px;margin-top:6px;align-items:center;">
            <a href=\"${mapsQuery}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:linear-gradient(135deg,#5b21b6,#06b6d4);text-decoration:none;\" title=\"Open\"> 
              <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2L15 8l6 1-4.5 4L18 21l-6-3-6 3 1.5-7L2 9l6-1 3-6z\" fill=\"white\"/></svg>
              <span style=\"color:#fff;font-weight:600;font-size:13px;\">Open</span>
            </a>
            <a href=\"${directionsLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:linear-gradient(135deg,#0ea5e9,#7c3aed);text-decoration:none;\" title=\"Directions\"> 
              <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 1118 0z\" fill=\"white\"/></svg>
              <span style=\"color:#fff;font-weight:600;font-size:13px;\">Route</span>
            </a>
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
      
      // Adjust zoom if too close
      setTimeout(() => {
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 16) {
          map.setZoom(16);
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, places, userLocation]);

  if (error) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-900 border border-purple-500/30 rounded-lg">
        <div className="text-center px-4">
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-3 rounded-lg overflow-hidden border border-purple-500/30 shadow-lg shadow-purple-500/20 relative">
      {/* Map Container */}
      <div 
        ref={setMapRef} 
        className="w-full h-[300px]"
      />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-t-2 border-purple-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-400">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Expand Button */}
      {!isLoading && (
        <button
          onClick={onExpandMap}
          className="absolute bottom-4 right-4 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-xl shadow-purple-500/50 rounded-lg px-4 py-2 flex items-center space-x-2 transition-all border border-purple-400/30"
        >
          <svg 
            className="w-4 h-4 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" 
            />
          </svg>
          <span className="text-sm font-medium text-white">View Full Map</span>
        </button>
      )}
      
      {/* Places Count Badge */}
      {!isLoading && (
        <div className="absolute top-4 left-4 bg-gradient-to-r from-purple-900/90 to-cyan-900/90 backdrop-blur-sm shadow-lg shadow-purple-500/30 rounded-lg px-3 py-1 border border-purple-400/30">
          <span className="text-sm font-medium text-purple-200">
            {places.length} place{places.length !== 1 ? 's' : ''} found
          </span>
        </div>
      )}
    </div>
  );
}
