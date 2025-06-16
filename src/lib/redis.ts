import { Redis } from '@upstash/redis';
import { Ratelimit, Duration } from '@upstash/ratelimit';

// Initialize Redis client
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('Upstash Redis environment variables are not set');
    }

    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redis;
}

// Rate limiter factory
export function createRateLimiter(options: {
  requests: number;
  window: Duration;
  prefix?: string;
}) {
  const redis = getRedis();
  
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(options.requests, options.window),
    prefix: options.prefix || '@upstash/ratelimit',
  });
}

// Cache utilities
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = getRedis();
      const data = await redis.get(key);
      if (!data) return null;
      
      // Parse JSON data if it's a string
      if (typeof data === 'string') {
        try {
          return JSON.parse(data) as T;
        } catch {
          // If parsing fails, return the raw data
          return data as T;
        }
      }
      
      return data as T;
    } catch (error) {
      console.error('Redis cache get error:', error);
      return null;
    }
  },

  async set(key: string, value: unknown, expirationSeconds?: number): Promise<void> {
    try {
      const redis = getRedis();
      if (expirationSeconds) {
        await redis.setex(key, expirationSeconds, JSON.stringify(value));
      } else {
        await redis.set(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
  },

  async delete(key: string): Promise<void> {
    try {
      const redis = getRedis();
      await redis.del(key);
    } catch (error) {
      console.error('Redis cache delete error:', error);
    }
  },

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const redis = getRedis();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Redis cache invalidate pattern error:', error);
    }
  },
};

// Cache key generators
export const cacheKeys = {
  session: (sessionId: string) => `session:${sessionId}`,
  userPreferences: (userId: string) => `user:${userId}:preferences`,
  modelCatalog: () => 'models:catalog',
  chatSummary: (sessionId: string) => `summary:${sessionId}`,
  userSessions: (userId: string) => `user:${userId}:sessions`,
};

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  SESSION: 600, // 10 minutes
  USER_PREFERENCES: 1800, // 30 minutes
  MODEL_CATALOG: 3600, // 1 hour
  CHAT_SUMMARY: 86400, // 24 hours
  USER_SESSIONS: 300, // 5 minutes
} as const;