/**
 * Client-side preferences cache for instant settings and preferences loading
 * Caches user preferences, starred models, learning preferences, etc.
 */

import { logger } from '@/lib/logger';

export interface CachedUserPreferences {
  // Chat settings
  defaultModel: string
  temperature: number
  maxTokens: number
  tone: string
  memoryEnabled: boolean
  memorySummaryCount: number
  storageEnabled: boolean
  
  // UI preferences
  theme?: string
  sidebarCollapsed?: boolean
  
  // Model preferences
  starredModels: string[]
  activeModels: string[]
  
  // Learning preferences
  learningPreferences: Record<string, unknown>
  
  // Usage data
  totalMessages?: number
  totalTokens?: number
  
  // Metadata
  lastSync: string
  userId: string
}

export interface PreferencesCacheMetadata {
  lastSync: string
  userId: string | null
  version: number // For cache schema versioning
}

const PREFERENCES_CACHE_KEY = 'duck-user-preferences'
const PREFERENCES_METADATA_KEY = 'duck-preferences-metadata'
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes
const CACHE_VERSION = 1

export const preferencesCache = {
  /**
   * Get cached preferences from localStorage
   */
  get: (): CachedUserPreferences | null => {
    try {
      const cached = localStorage.getItem(PREFERENCES_CACHE_KEY)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      logger.error('Failed to read preferences cache:', error)
      return null
    }
  },

  /**
   * Set preferences in localStorage
   */
  set: (preferences: CachedUserPreferences, userId: string) => {
    try {
      localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(preferences))
      localStorage.setItem(
        PREFERENCES_METADATA_KEY,
        JSON.stringify({
          lastSync: new Date().toISOString(),
          userId,
          version: CACHE_VERSION,
        } as PreferencesCacheMetadata)
      )
    } catch (error) {
      logger.error('Failed to write preferences cache:', error)
    }
  },

  /**
   * Update specific preference fields
   */
  update: (updates: Partial<CachedUserPreferences>) => {
    const current = preferencesCache.get()
    if (current) {
      const updated = { 
        ...current, 
        ...updates,
        lastSync: new Date().toISOString()
      }
      const metadata = preferencesCache.getMetadata()
      if (metadata?.userId) {
        preferencesCache.set(updated, metadata.userId)
      }
    }
  },

  /**
   * Add or remove starred model
   */
  toggleStarredModel: (modelId: string) => {
    const current = preferencesCache.get()
    if (current) {
      const starredModels = current.starredModels.includes(modelId)
        ? current.starredModels.filter(id => id !== modelId)
        : [...current.starredModels, modelId]
      
      preferencesCache.update({ starredModels })
    }
  },

  /**
   * Update learning preferences
   */
  updateLearningPreferences: (preferences: Record<string, unknown>) => {
    preferencesCache.update({ learningPreferences: preferences })
  },

  /**
   * Update active models list
   */
  updateActiveModels: (activeModels: string[]) => {
    preferencesCache.update({ activeModels })
  },

  /**
   * Check if cache is stale
   */
  isStale: (): boolean => {
    try {
      const metadata = localStorage.getItem(PREFERENCES_METADATA_KEY)
      if (!metadata) return true

      const { lastSync, version } = JSON.parse(metadata) as PreferencesCacheMetadata
      
      // Check version compatibility
      if (version !== CACHE_VERSION) return true
      
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
      const metadata = localStorage.getItem(PREFERENCES_METADATA_KEY)
      if (!metadata) return false

      const { userId: cachedUserId, version } = JSON.parse(metadata) as PreferencesCacheMetadata
      return cachedUserId === userId && version === CACHE_VERSION
    } catch {
      return false
    }
  },

  /**
   * Get cache metadata
   */
  getMetadata: (): PreferencesCacheMetadata | null => {
    try {
      const metadata = localStorage.getItem(PREFERENCES_METADATA_KEY)
      return metadata ? JSON.parse(metadata) : null
    } catch {
      return null
    }
  },

  /**
   * Clear the preferences cache
   */
  clear: () => {
    localStorage.removeItem(PREFERENCES_CACHE_KEY)
    localStorage.removeItem(PREFERENCES_METADATA_KEY)
  },

  /**
   * Transform API response to cached format
   */
  fromUserPreferencesAPI: (apiResponse: {
    default_model?: string
    temperature?: number
    max_tokens?: number
    tone?: string
    memory_enabled?: boolean
    memory_summary_count?: number
    storage_enabled?: boolean
    theme?: string
    sidebar_collapsed?: boolean
  }): Partial<CachedUserPreferences> => {
    return {
      defaultModel: apiResponse.default_model || 'anthropic/claude-3-5-sonnet-20241022',
      temperature: apiResponse.temperature || 0.7,
      maxTokens: apiResponse.max_tokens || 4000,
      tone: apiResponse.tone || 'balanced',
      memoryEnabled: apiResponse.memory_enabled ?? true,
      memorySummaryCount: apiResponse.memory_summary_count || 5,
      storageEnabled: apiResponse.storage_enabled ?? true,
      theme: apiResponse.theme,
      sidebarCollapsed: apiResponse.sidebar_collapsed,
    }
  },

  /**
   * Transform starred models API response
   */
  fromStarredModelsAPI: (starredModels: string[]): Partial<CachedUserPreferences> => {
    return { starredModels }
  },

  /**
   * Transform learning preferences API response
   */
  fromLearningPreferencesAPI: (preferences: Record<string, unknown>): Partial<CachedUserPreferences> => {
    return { learningPreferences: preferences }
  },

  /**
   * Get default preferences structure
   */
  getDefaults: (userId: string): CachedUserPreferences => {
    return {
      defaultModel: 'anthropic/claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 4000,
      tone: 'balanced',
      memoryEnabled: true,
      memorySummaryCount: 5,
      storageEnabled: true,
      starredModels: [],
      activeModels: [
        'anthropic/claude-3-5-sonnet-20241022',
        'openai/gpt-4o',
        'google/gemini-pro-1.5',
      ],
      learningPreferences: {} as Record<string, unknown>,
      lastSync: new Date().toISOString(),
      userId,
    }
  },

  /**
   * Merge multiple API responses into cache
   */
  mergeFromAPIs: (
    userPrefs: Record<string, unknown>,
    starredModels: string[],
    learningPrefs: Record<string, unknown>,
    userId: string
  ): CachedUserPreferences => {
    const defaults = preferencesCache.getDefaults(userId)
    const userPrefsData = preferencesCache.fromUserPreferencesAPI(userPrefs)
    
    return {
      ...defaults,
      ...userPrefsData,
      starredModels,
      learningPreferences: learningPrefs,
      lastSync: new Date().toISOString(),
      userId,
    }
  },
}