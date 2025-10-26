/**
 * Input Validation and Sanitization
 * Best Practice: Prevent XSS, injection attacks, and malformed data
 */

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .substring(0, 5000); // Limit length to prevent DoS
}

/**
 * Validate message content
 */
export function validateMessage(message: string): { valid: boolean; error?: string } {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message is required' };
  }

  const sanitized = message.trim();

  if (sanitized.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (sanitized.length > 5000) {
    return { valid: false, error: 'Message is too long (max 5000 characters)' };
  }

  return { valid: true };
}

/**
 * Validate location query
 */
export function validateLocationQuery(query: string): { valid: boolean; error?: string } {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Query is required' };
  }

  const sanitized = query.trim();

  if (sanitized.length === 0) {
    return { valid: false, error: 'Query cannot be empty' };
  }

  if (sanitized.length > 200) {
    return { valid: false, error: 'Query is too long (max 200 characters)' };
  }

  return { valid: true };
}

/**
 * Validate conversation history
 */
export function validateHistory(history: any[]): { valid: boolean; error?: string } {
  if (!Array.isArray(history)) {
    return { valid: false, error: 'History must be an array' };
  }

  if (history.length > 50) {
    return { valid: false, error: 'History is too long (max 50 messages)' };
  }

  for (const msg of history) {
    if (!msg.role || !msg.content) {
      return { valid: false, error: 'Invalid message format in history' };
    }
    if (!['user', 'model'].includes(msg.role)) {
      return { valid: false, error: 'Invalid role in history' };
    }
  }

  return { valid: true };
}

/**
 * Validate and sanitize coordinates
 */
export function validateCoordinates(lat: number, lng: number): { valid: boolean; error?: string } {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { valid: false, error: 'Coordinates must be numbers' };
  }

  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Invalid latitude' };
  }

  if (lng < -180 || lng > 180) {
    return { valid: false, error: 'Invalid longitude' };
  }

  return { valid: true };
}
