/**
 * API Key Manager
 * Best Practice: Secure API key handling and rotation support
 */

import { auditLogger } from './auditLogger';

interface ApiKeyConfig {
  key: string;
  usageCount: number;
  dailyLimit?: number;
  lastReset: Date;
}

class ApiKeyManager {
  private googleAiKey: ApiKeyConfig | null = null;
  private googleMapsKey: ApiKeyConfig | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const aiKey = process.env.GOOGLE_AI_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!aiKey || aiKey === 'your_google_ai_studio_api_key_here') {
      auditLogger.error('Google AI API key not configured');
    } else {
      this.googleAiKey = {
        key: aiKey,
        usageCount: 0,
        dailyLimit: 1500, // Gemini free tier: 1500 RPD
        lastReset: new Date(),
      };
    }

    if (!mapsKey || mapsKey === 'your_google_maps_api_key_here') {
      auditLogger.error('Google Maps API key not configured');
    } else {
      this.googleMapsKey = {
        key: mapsKey,
        usageCount: 0,
        dailyLimit: 10000, // Adjust based on your plan
        lastReset: new Date(),
      };
    }
  }

  private resetIfNeeded(config: ApiKeyConfig): void {
    const now = new Date();
    const hoursSinceReset = (now.getTime() - config.lastReset.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReset >= 24) {
      config.usageCount = 0;
      config.lastReset = now;
      auditLogger.info('API usage counter reset', { hoursSinceReset });
    }
  }

  private canUseKey(config: ApiKeyConfig | null, service: string): boolean {
    if (!config) {
      auditLogger.error(`${service} API key not available`);
      return false;
    }

    this.resetIfNeeded(config);

    if (config.dailyLimit && config.usageCount >= config.dailyLimit) {
      auditLogger.warn(`${service} daily limit reached`, {
        usageCount: config.usageCount,
        dailyLimit: config.dailyLimit,
      });
      return false;
    }

    return true;
  }

  getGoogleAiKey(): string | null {
    if (!this.canUseKey(this.googleAiKey, 'Google AI')) {
      return null;
    }

    if (this.googleAiKey) {
      this.googleAiKey.usageCount++;
      return this.googleAiKey.key;
    }

    return null;
  }

  getGoogleMapsKey(): string | null {
    if (!this.canUseKey(this.googleMapsKey, 'Google Maps')) {
      return null;
    }

    if (this.googleMapsKey) {
      this.googleMapsKey.usageCount++;
      return this.googleMapsKey.key;
    }

    return null;
  }

  getUsageStats(): {
    googleAi: { count: number; limit?: number; remaining?: number };
    googleMaps: { count: number; limit?: number; remaining?: number };
  } {
    return {
      googleAi: {
        count: this.googleAiKey?.usageCount || 0,
        limit: this.googleAiKey?.dailyLimit,
        remaining: this.googleAiKey?.dailyLimit
          ? this.googleAiKey.dailyLimit - this.googleAiKey.usageCount
          : undefined,
      },
      googleMaps: {
        count: this.googleMapsKey?.usageCount || 0,
        limit: this.googleMapsKey?.dailyLimit,
        remaining: this.googleMapsKey?.dailyLimit
          ? this.googleMapsKey.dailyLimit - this.googleMapsKey.usageCount
          : undefined,
      },
    };
  }
}

// Singleton instance
export const apiKeyManager = new ApiKeyManager();
