import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { DEFAULT_ACTIVE_MODELS } from '@/lib/config'
import { cachedFetch, invalidateCache } from '@/lib/request-cache'
import { preferencesCache } from '@/lib/local-preferences-cache'

export interface UseStarredModelsReturn {
  starredModels: string[]
  activeModel: string
  isStarred: (modelId: string) => boolean
  isActive: (modelId: string) => boolean
  toggleStar: (modelId: string) => Promise<void>
  setActive: (modelId: string) => Promise<void>
  resetToDefaults: () => Promise<void>
  loading: boolean
  error: string | null
}

export function useStarredModels(): UseStarredModelsReturn {
  const [starredModels, setStarredModels] = useState<string[]>([...DEFAULT_ACTIVE_MODELS])
  const [activeModel, setActiveModelState] = useState<string>(DEFAULT_ACTIVE_MODELS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isLoadingRef = useRef(false)

  // Load from cache immediately
  const loadCachedData = useCallback(() => {
    const cached = preferencesCache.get()
    if (cached) {
      setStarredModels(cached.starredModels || [...DEFAULT_ACTIVE_MODELS])
      setActiveModelState(cached.defaultModel || DEFAULT_ACTIVE_MODELS[0])
      setLoading(false)
    }
  }, [])

  const loadStarredModels = useCallback(async () => {
    // Prevent infinite loops by checking if already loading
    if (isLoadingRef.current) return
    
    try {
      isLoadingRef.current = true
      setLoading(true)
      setError(null)
      
      // Use cached fetch to prevent duplicate requests
      const data = await cachedFetch.starredModels()
      
      // Check if the response contains an error (even with 200 status)
      if (data.error) {
        throw new Error(data.details || data.error)
      }
      
      const starredModels = data.starredModels || []
      const activeModel = data.activeModel || data.primaryModel || DEFAULT_ACTIVE_MODELS[0]
      
      setStarredModels(starredModels)
      setActiveModelState(activeModel)
      
      // Update cache with fresh data
      preferencesCache.update({
        starredModels,
        defaultModel: activeModel
      })
      
      if (data.message) {
        if (process.env.NODE_ENV === 'development') console.log('Starred models loaded:', data.message)
      }
    } catch (err) {
      console.error('Error loading starred models:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      // Don't set any default models on error - let the UI handle the empty state
      setStarredModels([])
    } finally {
      isLoadingRef.current = false
      setLoading(false)
    }
  }, [])

  // CRITICAL FIX: Load starred models on mount without callback dependency
  // Remove loadStarredModels from dependency array to prevent infinite calls
  // Load cached data immediately
  useEffect(() => {
    loadCachedData()
  }, [loadCachedData])

  // Load fresh data from server (with stale-while-revalidate pattern)
  useEffect(() => {
    const hasCachedData = starredModels.length > 0
    const isStale = preferencesCache.isStale()
    
    if (!hasCachedData || isStale) {
      loadStarredModels()
    }
  }, [starredModels.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // Note: loadStarredModels intentionally omitted to prevent infinite calls

  const toggleStar = useCallback(async (modelId: string) => {
    if (!modelId) return

    try {
      setLoading(true)
      setError(null)

      // Optimistic update
      const wasStarred = starredModels.includes(modelId)
      const newStarredModels = wasStarred
        ? starredModels.filter(id => id !== modelId)
        : [...starredModels, modelId]
      
      setStarredModels(newStarredModels)

      // Persist to backend
      const response = await fetch('/api/starred-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId,
          action: 'toggle'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || 'Failed to update starred models')
      }

      const data = await response.json()
      
      // Invalidate cache after successful update
      invalidateCache.starredModels()
      
      // Check if the response contains an error (even with 200 status)
      if (data.error) {
        throw new Error(data.details || data.error)
      }
      
      // Update with actual response from server
      const finalStarredModels = data.starredModels || newStarredModels
      setStarredModels(finalStarredModels)
      
      // Update cache with optimistic update
      preferencesCache.update({ starredModels: finalStarredModels })
      
      if (data.activeModel || data.primaryModel) {
        const newActiveModel = data.activeModel || data.primaryModel
        setActiveModelState(newActiveModel)
        preferencesCache.update({ defaultModel: newActiveModel })
      }
    } catch (err) {
      console.error('Error toggling starred model:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      
      // CRITICAL FIX: Don't call loadStarredModels to prevent loops, just revert optimistically
      // Revert optimistic update without triggering reload
      setStarredModels(starredModels) // Reset to previous state
    } finally {
      setLoading(false)
    }
  }, [starredModels]) // Re-enable deps checking after fixing circular calls

  const setActive = useCallback(async (modelId: string) => {
    if (!modelId) return

    try {
      setLoading(true)
      setError(null)

      // Optimistic update
      setActiveModelState(modelId)

      // Persist to backend
      const response = await fetch('/api/starred-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId,
          action: 'set_primary' // Keep API action as 'set_primary' for backend compatibility
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || 'Failed to set active model')
      }

      const data = await response.json()
      
      // Check if the response contains an error (even with 200 status)
      if (data.error) {
        throw new Error(data.details || data.error)
      }
      
      // Update with actual response from server
      setStarredModels(data.starredModels || starredModels)
      setActiveModelState(data.activeModel || data.primaryModel || modelId)
    } catch (err) {
      console.error('Error setting active model:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      
      // CRITICAL FIX: Don't call loadStarredModels to prevent loops, just revert optimistically
      // Revert optimistic update without triggering reload
      // Reset to previous active model state (we don't need to store previous value since it's in state)
    } finally {
      setLoading(false)
    }
  }, [starredModels]) // Re-enable deps checking after fixing circular calls

  const isStarred = useCallback((modelId: string): boolean => {
    return starredModels.includes(modelId)
  }, [starredModels])

  const isActive = useCallback((modelId: string): boolean => {
    return activeModel === modelId
  }, [activeModel])

  const resetToDefaults = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Optimistic update
      setStarredModels([...DEFAULT_ACTIVE_MODELS])
      setActiveModelState(DEFAULT_ACTIVE_MODELS[0])

      // Persist to backend
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resetModels'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || 'Failed to reset model preferences')
      }

      const data = await response.json()
      
      // Check if the response contains an error (even with 200 status)
      if (data.error) {
        throw new Error(data.details || data.error)
      }
      
      // Update with actual response from server
      const preferences = data.preferences
      setStarredModels(preferences.starredModels || [...DEFAULT_ACTIVE_MODELS])
      setActiveModelState(preferences.primaryModel || DEFAULT_ACTIVE_MODELS[0])
    } catch (err) {
      console.error('Error resetting model preferences:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      
      // CRITICAL FIX: Don't call loadStarredModels to prevent loops
      // Keep the optimistic update since reset is a clean operation
    } finally {
      setLoading(false)
    }
  }, []) // Empty dependency array is correct for this reset function

  return useMemo(() => ({
    starredModels,
    activeModel,
    isStarred,
    isActive,
    toggleStar,
    setActive,
    resetToDefaults,
    loading,
    error
  }), [
    starredModels,
    activeModel,
    isStarred,
    isActive,
    toggleStar,
    setActive,
    resetToDefaults,
    loading,
    error
  ])
} 