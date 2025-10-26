/**
 * Rate Limiting Middleware
 * Implements token bucket algorithm for API rate limiting
 * Best Practice: Prevents API abuse and controls costs
 */

interface RateLimitStore {
  [key: string]: {
    tokens: number;
    lastRefill: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier: string;
}

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed under rate limit
   * @param identifier - Unique identifier (IP address, user ID, session ID)
   * @returns Object with allowed status and remaining requests
   */
  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    
    if (!store[identifier]) {
      store[identifier] = {
        tokens: this.maxRequests - 1,
        lastRefill: now,
      };
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: now + this.windowMs,
      };
    }

    const timePassed = now - store[identifier].lastRefill;
    const refillAmount = Math.floor(timePassed / this.windowMs) * this.maxRequests;

    if (refillAmount > 0) {
      store[identifier].tokens = Math.min(
        this.maxRequests,
        store[identifier].tokens + refillAmount
      );
      store[identifier].lastRefill = now;
    }

    if (store[identifier].tokens > 0) {
      store[identifier].tokens--;
      return {
        allowed: true,
        remaining: store[identifier].tokens,
        resetAt: store[identifier].lastRefill + this.windowMs,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: store[identifier].lastRefill + this.windowMs,
    };
  }

  /**
   * Get rate limit info without consuming a token
   */
  getInfo(identifier: string): { limit: number; remaining: number; resetAt: number } {
    if (!store[identifier]) {
      return {
        limit: this.maxRequests,
        remaining: this.maxRequests,
        resetAt: Date.now() + this.windowMs,
      };
    }

    return {
      limit: this.maxRequests,
      remaining: store[identifier].tokens,
      resetAt: store[identifier].lastRefill + this.windowMs,
    };
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string): void {
    delete store[identifier];
  }

  /**
   * Clean up old entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    Object.keys(store).forEach((key) => {
      if (now - store[key].lastRefill > this.windowMs * 2) {
        delete store[key];
      }
    });
  }
}

/**
 * Get client identifier from request
 * Uses multiple methods for reliability
 */
export function getClientIdentifier(req: Request): string {
  // Try to get real IP behind proxies
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  
  let ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  // Fallback to user-agent for additional uniqueness
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  return `${ip}:${userAgent.substring(0, 50)}`;
}

// Global rate limiters for different endpoints
export const aiChatLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000')
);

export const mapsLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000')
);

// Cleanup old entries every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    aiChatLimiter.cleanup();
    mapsLimiter.cleanup();
  }, 300000);
}

/**
 * Add rate limit headers to NextResponse
 */
export function addRateLimitHeaders(
  response: Response,
  limit: number,
  remaining: number,
  resetAt: number
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', limit.toString());
  headers.set('X-RateLimit-Remaining', remaining.toString());
  headers.set('X-RateLimit-Reset', Math.floor(resetAt / 1000).toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
