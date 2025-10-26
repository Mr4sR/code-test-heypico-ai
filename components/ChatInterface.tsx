'use client';

import { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import MapDisplay from './MapDisplay';
import MapPreview from './MapPreview';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  places?: Place[];
}

interface Place {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  rating?: number;
  userRatingsTotal?: number;
}

interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [showFullMap, setShowFullMap] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Request user location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationPermission('granted');
        console.log('User location obtained:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Error getting user location:', error);
        setLocationPermission('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare history for AI context
      const history = messages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        content: msg.content,
      }));

      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.trim(),
          history,
          userLocation: userLocation ? {
            lat: userLocation.lat,
            lng: userLocation.lng,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await response.json();

      // Add AI response to messages WITH places data
      const aiMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        places: undefined, // Will be set if location action exists
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Check if AI wants to search for places
      if (data.locationAction) {
        await handlePlaceSearch(data.locationAction, aiMessage.id);
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handlePlaceSearch = async (locationAction: any, messageId: string) => {
    try {
      console.log('Starting place search with:', locationAction);
      
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: locationAction.query,
          type: locationAction.type,
          location: locationAction.location,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to search places');
      }

      const data = await response.json();
      console.log('Places API response:', data);

      if (data.places && data.places.length > 0) {
        console.log('Setting places:', data.places);
        console.log('First place coordinates:', data.places[0].location);
        
        // Update the message with places data
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === messageId 
              ? { ...msg, places: data.places }
              : msg
          )
        );
        
        setPlaces(data.places);
      } else {
        console.warn('No places found in response');
      }
    } catch (error) {
      console.error('Place search error:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 via-purple-900/20 to-gray-900 shadow-lg shadow-purple-500/10 border-b border-purple-500/20 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              HeyPico.ai
            </h1>
            <p className="text-sm text-gray-400">
              Powered by Google AI Studio • Ask me about places to visit!
              {userLocation && (
                <span className="ml-2 text-cyan-400">
                  📍 Location detected
                </span>
              )}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 custom-scrollbar">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 rounded-full p-6 mb-6 shadow-lg shadow-purple-500/50">
                  <svg
                    className="w-16 h-16 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  Welcome! How can I help you today?
                </h2>
                <p className="text-gray-400 max-w-md">
                  Ask me anything! I can help you find restaurants, cafes, tourist attractions,
                  and other places. Try: "Find good restaurants near me"
                </p>
              </div>
            )}

            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onExpandMap={(places) => {
                  setPlaces(places);
                  setShowFullMap(true);
                }}
                userLocation={userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null}
              />
            ))}

            {isLoading && (
              <div className="flex items-start space-x-2 fade-in">
                <div className="bg-gray-800 border border-purple-500/20 rounded-2xl px-4 py-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full typing-dot"></div>
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full typing-dot"></div>
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full typing-dot"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-purple-500/20 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-900 px-4 py-4 shadow-lg shadow-purple-500/10">
            <div className="flex items-end space-x-2 max-w-4xl mx-auto">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Shift + Enter for new line)"
                disabled={isLoading}
                className="flex-1 resize-none rounded-lg border border-purple-500/30 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
                style={{ maxHeight: '120px', minHeight: '48px' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg px-6 py-3 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg shadow-purple-500/30"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

      {/* Full Map Modal */}
      {showFullMap && places.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50">
          <div className="absolute inset-4 bg-gray-900 border border-purple-500/30 rounded-lg overflow-hidden flex flex-col shadow-2xl shadow-purple-500/20">
            <div className="flex items-center justify-between p-4 border-b border-purple-500/20 bg-gradient-to-r from-gray-900 via-purple-900/10 to-gray-900 flex-shrink-0">
              <h3 className="font-semibold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Places Found ({places.length})
              </h3>
              <button
                onClick={() => setShowFullMap(false)}
                className="text-gray-400 hover:text-purple-400 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MapDisplay key="full-map" places={places} userLocation={userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
