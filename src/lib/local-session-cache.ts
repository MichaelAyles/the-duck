/**
 * Client-side session cache for instant chat history loading
 * Similar to how Gemini and other chat services provide instant access
 */

import { logger } from '@/lib/logger';

export interface CachedSession {
  id: string
  title: string
  updatedAt: string
  messageCount: number
  preview: string
  model?: string
}

export interface CacheMetadata {
  lastSync: string
  userId: string | null
}

const CACHE_KEY = 'duck-chat-sessions'
const METADATA_KEY = 'duck-cache-metadata'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export const sessionCache = {
  /**
   * Get cached sessions from localStorage
   */
  get: (): CachedSession[] => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      return cached ? JSON.parse(cached) : []
    } catch (error) {
      logger.error('Failed to read session cache:', error)
      return []
    }
  },

  /**
   * Set sessions in localStorage
   */
  set: (sessions: CachedSession[], userId: string | null = null) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(sessions))
      localStorage.setItem(
        METADATA_KEY,
        JSON.stringify({
          lastSync: new Date().toISOString(),
          userId,
        } as CacheMetadata)
      )
    } catch (error) {
      logger.error('Failed to write session cache:', error)
    }
  },

  /**
   * Update a single session in the cache
   */
  update: (sessionId: string, updates: Partial<CachedSession>) => {
    const sessions = sessionCache.get()
    const index = sessions.findIndex((s) => s.id === sessionId)
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...updates }
      sessionCache.set(sessions)
    } else {
      // Add new session to the beginning
      sessions.unshift({ id: sessionId, ...updates } as CachedSession)
      sessionCache.set(sessions)
    }
  },

  /**
   * Add or move session to top of list (for recent activity)
   */
  touch: (session: CachedSession) => {
    const sessions = sessionCache.get().filter((s) => s.id !== session.id)
    sessions.unshift(session)
    sessionCache.set(sessions)
  },

  /**
   * Remove a session from cache
   */
  remove: (sessionId: string) => {
    const sessions = sessionCache.get().filter((s) => s.id !== sessionId)
    sessionCache.set(sessions)
  },

  /**
   * Check if cache is stale
   */
  isStale: (): boolean => {
    try {
      const metadata = localStorage.getItem(METADATA_KEY)
      if (!metadata) return true

      const { lastSync } = JSON.parse(metadata) as CacheMetadata
      const age = Date.now() - new Date(lastSync).getTime()
      return age > CACHE_DURATION
    } catch {
      return true
    }
  },

  /**
   * Check if cache belongs to current user
   */
  isValidForUser: (userId: string | null): boolean => {
    try {
      const metadata = localStorage.getItem(METADATA_KEY)
      if (!metadata) return false

      const { userId: cachedUserId } = JSON.parse(metadata) as CacheMetadata
      return cachedUserId === userId
    } catch {
      return false
    }
  },

  /**
   * Clear the cache
   */
  clear: () => {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(METADATA_KEY)
  },

  /**
   * Transform API response to cached format
   */
  fromApiResponse: (sessions: Array<{
    id: string;
    title?: string;
    updated_at: string;
    messages?: Array<{ content: string; role: string }>;
    settings?: { model?: string };
  }>): CachedSession[] => {
    return sessions.map((session) => ({
      id: session.id,
      title: session.title || 'New Chat',
      updatedAt: session.updated_at,
      messageCount: session.messages?.length || 0,
      preview: session.messages?.[0]?.content?.substring(0, 100) || '',
      model: session.settings?.model,
    }))
  },
}