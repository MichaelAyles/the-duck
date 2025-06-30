/**
 * 🚀 Request Cache & Deduplication
 * 
 * Prevents duplicate API calls and provides caching for frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pendingRequests = new Map<string, Promise<unknown>>();
  
  // Cache TTL in milliseconds
  private readonly TTL = {
    STARRED_MODELS: 5 * 60 * 1000, // 5 minutes
    USER_PREFERENCES: 5 * 60 * 1000, // 5 minutes
    SESSIONS: 2 * 60 * 1000, // 2 minutes
    CHAT_HISTORY: 1 * 60 * 1000, // 1 minute
    DEFAULT: 30 * 1000, // 30 seconds
  } as const;

  /**
   * Get cached data or fetch if not available/expired
   */
  async get<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);
    const cacheTTL = ttl || this.TTL.DEFAULT;

    // Return cached data if valid
    if (entry && (now - entry.timestamp) < cacheTTL) {
      return entry.data as T;
    }

    // Check if request is already pending
    const pendingRequest = this.pendingRequests.get(key);
    if (pendingRequest) {
      return pendingRequest as Promise<T>;
    }

    // Create new request
    const request = fetcher().then(data => {
      // Cache the result
      this.cache.set(key, {
        data,
        timestamp: now,
      });
      
      // Remove from pending requests
      this.pendingRequests.delete(key);
      
      return data;
    }).catch(error => {
      // Remove from pending requests on error
      this.pendingRequests.delete(key);
      throw error;
    });

    // Store pending request
    this.pendingRequests.set(key, request);
    
    return request;
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }

  /**
   * Invalidate all cache entries matching pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
    
    for (const key of this.pendingRequests.keys()) {
      if (regex.test(key)) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// Global request cache instance
export const requestCache = new RequestCache();

// Helper functions for common API endpoints
export const cachedFetch = {
  starredModels: () => requestCache.get(
    'starred-models',
    () => fetch('/api/starred-models').then(r => r.json()),
    requestCache['TTL'].STARRED_MODELS
  ),
  
  userPreferences: () => requestCache.get(
    'user-preferences', 
    () => fetch('/api/user/preferences').then(r => r.json()),
    requestCache['TTL'].USER_PREFERENCES
  ),
  
  sessions: (limit = 50) => requestCache.get(
    `sessions-${limit}`,
    () => fetch(`/api/sessions?limit=${limit}`).then(r => r.json()),
    requestCache['TTL'].SESSIONS
  ),
  
  chatHistory: (limit = 50) => requestCache.get(
    `chat-history-${limit}`,
    () => fetch(`/api/chat-history?limit=${limit}`).then(r => r.json()),
    requestCache['TTL'].CHAT_HISTORY
  ),
};

// Cache invalidation helpers
export const invalidateCache = {
  starredModels: () => requestCache.invalidate('starred-models'),
  userPreferences: () => requestCache.invalidate('user-preferences'),
  sessions: () => requestCache.invalidatePattern('sessions-'),
  chatHistory: () => requestCache.invalidatePattern('chat-history-'),
  all: () => requestCache.clear(),
};