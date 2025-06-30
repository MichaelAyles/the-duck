/**
 * Comprehensive user preferences hook with instant loading from cache
 * Combines starred models, chat settings, learning preferences, etc.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { preferencesCache, type CachedUserPreferences } from '@/lib/local-preferences-cache'
import { useAuth } from '@/components/auth/auth-provider'
import { logger } from '@/lib/logger'
// Import removed - DEFAULT_ACTIVE_MODELS not needed in this hook

export interface UseUserPreferencesReturn {
  // Preferences data
  preferences: CachedUserPreferences | null
  
  // Loading states
  loading: boolean
  isLoadingFresh: boolean
  error: string | null
  
  // Update functions
  updateChatSettings: (settings: Partial<CachedUserPreferences>) => Promise<void>
  toggleStarredModel: (modelId: string) => Promise<void>
  updateLearningPreferences: (preferences: Record<string, unknown>) => Promise<void>
  updateActiveModels: (activeModels: string[]) => Promise<void>
  
  // Utility functions
  isStarred: (modelId: string) => boolean
  refreshAll: () => Promise<void>
}

export function useUserPreferences(): UseUserPreferencesReturn {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<CachedUserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoadingFresh, setIsLoadingFresh] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isLoadingRef = useRef(false)

  // Load cached preferences immediately
  const loadCachedPreferences = useCallback(() => {
    if (!user) return

    // Check if cache is valid for current user
    if (!preferencesCache.isValidForUser(user.id)) {
      preferencesCache.clear()
      return
    }

    const cached = preferencesCache.get()
    if (cached) {
      setPreferences(cached)
      setLoading(false)
    }
  }, [user])

  // Load fresh preferences from all APIs
  const loadFreshPreferences = useCallback(async (force = false) => {
    if (!user || (isLoadingRef.current && !force)) return

    try {
      isLoadingRef.current = true
      setIsLoadingFresh(true)
      setError(null)

      // Fetch from all preference endpoints in parallel
      const [userPrefsResponse, starredModelsResponse, learningPrefsResponse] = await Promise.allSettled([
        fetch('/api/user/preferences'),
        fetch('/api/starred-models'),
        fetch('/api/learning-preferences'),
      ])

      // Process user preferences
      let userPrefs = {}
      if (userPrefsResponse.status === 'fulfilled' && userPrefsResponse.value.ok) {
        userPrefs = await userPrefsResponse.value.json()
      }

      // Process starred models
      let starredModels: string[] = []
      if (starredModelsResponse.status === 'fulfilled' && starredModelsResponse.value.ok) {
        const starredData = await starredModelsResponse.value.json()
        starredModels = starredData.starredModels || []
      }

      // Process learning preferences
      let learningPrefs: Record<string, unknown> = {}
      if (learningPrefsResponse.status === 'fulfilled' && learningPrefsResponse.value.ok) {
        const learningData = await learningPrefsResponse.value.json()
        learningPrefs = learningData.preferences || {}
      }

      // Merge all data into cache format
      const mergedPreferences = preferencesCache.mergeFromAPIs(
        userPrefs,
        starredModels,
        learningPrefs,
        user.id
      )

      // Update cache and state
      preferencesCache.set(mergedPreferences, user.id)
      setPreferences(mergedPreferences)

    } catch (err) {
      logger.error('Error loading user preferences:', err)
      setError(err instanceof Error ? err.message : 'Failed to load preferences')
    } finally {
      isLoadingRef.current = false
      setIsLoadingFresh(false)
      setLoading(false)
    }
  }, [user])

  // Update chat settings
  const updateChatSettings = useCallback(async (settings: Partial<CachedUserPreferences>) => {
    if (!user) return

    try {
      setError(null)

      // Optimistic update
      if (preferences) {
        const updated = { ...preferences, ...settings }
        setPreferences(updated)
        preferencesCache.update(settings)
      }

      // Persist to backend
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error('Failed to update chat settings')
      }

      const data = await response.json()
      const updatedPrefs = preferencesCache.fromUserPreferencesAPI(data)
      preferencesCache.update(updatedPrefs)

    } catch (err) {
      logger.error('Error updating chat settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      // Reload to get correct state
      loadFreshPreferences(true)
    }
  }, [user, preferences, loadFreshPreferences])

  // Toggle starred model
  const toggleStarredModel = useCallback(async (modelId: string) => {
    if (!user || !preferences) return

    try {
      setError(null)

      // Optimistic update
      const isCurrentlyStarred = preferences.starredModels.includes(modelId)
      const newStarredModels = isCurrentlyStarred
        ? preferences.starredModels.filter(id => id !== modelId)
        : [...preferences.starredModels, modelId]

      const updated = { ...preferences, starredModels: newStarredModels }
      setPreferences(updated)
      preferencesCache.update({ starredModels: newStarredModels })

      // Persist to backend
      const response = await fetch('/api/starred-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, action: 'toggle' }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle starred model')
      }

      const data = await response.json()
      preferencesCache.update({ 
        starredModels: data.starredModels || newStarredModels 
      })

    } catch (err) {
      logger.error('Error toggling starred model:', err)
      setError(err instanceof Error ? err.message : 'Failed to update starred model')
      // Reload to get correct state
      loadFreshPreferences(true)
    }
  }, [user, preferences, loadFreshPreferences])

  // Update learning preferences
  const updateLearningPreferences = useCallback(async (learningPrefs: Record<string, unknown>) => {
    if (!user) return

    try {
      setError(null)

      // Optimistic update
      if (preferences) {
        const updated = { ...preferences, learningPreferences: learningPrefs }
        setPreferences(updated)
        preferencesCache.update({ learningPreferences: learningPrefs })
      }

      // Persist to backend
      const response = await fetch('/api/learning-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: learningPrefs }),
      })

      if (!response.ok) {
        throw new Error('Failed to update learning preferences')
      }

    } catch (err) {
      logger.error('Error updating learning preferences:', err)
      setError(err instanceof Error ? err.message : 'Failed to update learning preferences')
      // Reload to get correct state
      loadFreshPreferences(true)
    }
  }, [user, preferences, loadFreshPreferences])

  // Update active models
  const updateActiveModels = useCallback(async (activeModels: string[]) => {
    if (!user) return

    try {
      setError(null)

      // Optimistic update
      if (preferences) {
        const updated = { ...preferences, activeModels }
        setPreferences(updated)
        preferencesCache.update({ activeModels })
      }

      // Note: This might need a dedicated API endpoint if active models are stored separately

    } catch (err) {
      logger.error('Error updating active models:', err)
      setError(err instanceof Error ? err.message : 'Failed to update active models')
    }
  }, [user, preferences])

  // Utility function to check if model is starred
  const isStarred = useCallback((modelId: string): boolean => {
    return preferences?.starredModels.includes(modelId) || false
  }, [preferences])

  // Refresh all preferences
  const refreshAll = useCallback(async () => {
    await loadFreshPreferences(true)
  }, [loadFreshPreferences])

  // Load cached data immediately when user becomes available
  useEffect(() => {
    if (user) {
      loadCachedPreferences()
    }
  }, [user, loadCachedPreferences])

  // Load fresh data if cache is stale or missing
  useEffect(() => {
    if (user) {
      const hasCachedData = preferences !== null
      const isStale = preferencesCache.isStale()

      if (!hasCachedData || isStale) {
        loadFreshPreferences()
      }
    }
  }, [user, preferences, loadFreshPreferences])

  return {
    preferences,
    loading,
    isLoadingFresh,
    error,
    updateChatSettings,
    toggleStarredModel,
    updateLearningPreferences,
    updateActiveModels,
    isStarred,
    refreshAll,
  }
}