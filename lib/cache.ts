/**
 * Simple in-memory cache for API responses
 * Best Practice: Reduce API calls and costs
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL: number = 3600000) { // 1 hour default
    this.defaultTTL = defaultTTL;
  }

  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (ttl || this.defaultTTL),
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

// Create specific caches
export const placesCache = new Cache<any>(3600000); // 1 hour for places
export const geocodeCache = new Cache<any>(86400000); // 24 hours for geocoding

// Cleanup old entries every 10 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    placesCache.cleanup();
    geocodeCache.cleanup();
  }, 600000);
}
