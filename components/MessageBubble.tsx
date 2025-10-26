'use client';

import ReactMarkdown from 'react-markdown';
import MapPreview from './MapPreview';

interface Place {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  rating?: number;
  userRatingsTotal?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  places?: Place[];
}

interface MessageBubbleProps {
  message: Message;
  onExpandMap?: (places: Place[]) => void;
  userLocation?: { lat: number; lng: number } | null;
}

export default function MessageBubble({ message, onExpandMap, userLocation }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // Clean up JSON from AI response for display
  const cleanContent = message.content.replace(/\{[\s\S]*?"action":\s*"search_places"[\s\S]*?\}/g, '').trim();

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} fade-in`}>
      <div className={`flex items-start space-x-2 max-w-[80%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
          isUser 
            ? 'bg-gradient-to-br from-purple-600 to-cyan-600 shadow-purple-500/50' 
            : 'bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 shadow-pink-500/50'
        }`}>
          {isUser ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
          )}
        </div>

        {/* Message Bubble */}
        <div className="flex-1">
          <div
            className={`rounded-2xl px-4 py-3 shadow-lg ${
              isUser
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-purple-500/30'
                : 'bg-gray-800 border border-purple-500/20 text-gray-100 shadow-purple-500/10'
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    code: ({ children }) => (
                      <code className="bg-gray-900 border border-purple-500/30 text-cyan-300 px-1 py-0.5 rounded text-sm">
                        {children}
                      </code>
                    ),
                  }}
                >
                  {cleanContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
          
          {/* Map Preview - shown for assistant messages with places */}
          {!isUser && message.places && message.places.length > 0 && (
            <MapPreview
              places={message.places}
              onExpandMap={() => onExpandMap && onExpandMap(message.places!)}
              userLocation={userLocation}
            />
          )}
          
          {/* Timestamp */}
          <p className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}
