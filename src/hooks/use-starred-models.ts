import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_ACTIVE_MODELS } from '@/lib/config'

export interface UseStarredModelsReturn {
  starredModels: string[]
  activeModel: string
  isStarred: (modelId: string) => boolean
  isActive: (modelId: string) => boolean
  toggleStar: (modelId: string) => Promise<void>
  setActive: (modelId: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function useStarredModels(): UseStarredModelsReturn {
  const [starredModels, setStarredModels] = useState<string[]>([...DEFAULT_ACTIVE_MODELS])
  const [activeModel, setActiveModelState] = useState<string>(DEFAULT_ACTIVE_MODELS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load starred models on mount
  useEffect(() => {
    loadStarredModels()
  }, [])

  const loadStarredModels = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/starred-models')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || 'Failed to load starred models')
      }
      
      const data = await response.json()
      
      // Check if the response contains an error (even with 200 status)
      if (data.error) {
        throw new Error(data.details || data.error)
      }
      
      setStarredModels(data.starredModels || [])
      setActiveModelState(data.activeModel || data.primaryModel || DEFAULT_ACTIVE_MODELS[0])
      
      if (data.message) {
        console.log('Starred models loaded:', data.message)
      }
    } catch (err) {
      console.error('Error loading starred models:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      // Don't set any default models on error - let the UI handle the empty state
      setStarredModels([])
    } finally {
      setLoading(false)
    }
  }

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
      
      // Check if the response contains an error (even with 200 status)
      if (data.error) {
        throw new Error(data.details || data.error)
      }
      
      // Update with actual response from server
      setStarredModels(data.starredModels || newStarredModels)
      if (data.activeModel || data.primaryModel) {
        setActiveModelState(data.activeModel || data.primaryModel)
      }
    } catch (err) {
      console.error('Error toggling starred model:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      
      // Revert optimistic update on error
      await loadStarredModels()
    } finally {
      setLoading(false)
    }
  }, [starredModels])

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
      
      // Revert optimistic update on error
      await loadStarredModels()
    } finally {
      setLoading(false)
    }
  }, [starredModels])

  const isStarred = useCallback((modelId: string): boolean => {
    return starredModels.includes(modelId)
  }, [starredModels])

  const isActive = useCallback((modelId: string): boolean => {
    return activeModel === modelId
  }, [activeModel])

  return {
    starredModels,
    activeModel,
    isStarred,
    isActive,
    toggleStar,
    setActive,
    loading,
    error
  }
} 