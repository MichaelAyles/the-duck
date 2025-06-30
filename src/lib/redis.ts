import { Redis } from '@upstash/redis';
import { Ratelimit, Duration } from '@upstash/ratelimit';
import { logger } from '@/lib/logger';

// Initialize Redis client
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      // During build time, create a mock Redis instance that won't be used
      if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV) {
        throw new Error('Upstash Redis environment variables are not set');
      }
      
      // Return a mock Redis instance for build time
      return {
        get: async () => null,
        set: async () => 'OK',
        setex: async () => 'OK',
        del: async () => 0,
        keys: async () => [],
      } as unknown as Redis;
    }

    // Clean environment variables (remove quotes)
    const cleanUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/^["']|["']$/g, '')
    const cleanToken = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/^["']|["']$/g, '')
    
    redis = new Redis({
      url: cleanUrl,
      token: cleanToken,
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
  
  // If we don't have Redis environment variables (build time), return a mock rate limiter
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      limit: async () => ({ success: true, limit: options.requests, remaining: options.requests, reset: Date.now() + 60000 }),
      reset: async () => ({ success: true }),
    } as unknown as Ratelimit;
  }
  
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
      logger.error('Redis cache get error:', error);
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
      logger.error('Redis cache set error:', error);
    }
  },

  async delete(key: string): Promise<void> {
    try {
      const redis = getRedis();
      await redis.del(key);
    } catch (error) {
      logger.error('Redis cache delete error:', error);
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
      logger.error('Redis cache invalidate pattern error:', error);
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