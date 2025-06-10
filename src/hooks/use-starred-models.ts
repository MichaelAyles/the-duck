import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_STARRED_MODELS } from '@/lib/db/supabase-operations'

export interface UseStarredModelsReturn {
  starredModels: string[]
  isStarred: (modelId: string) => boolean
  toggleStar: (modelId: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function useStarredModels(): UseStarredModelsReturn {
  const [starredModels, setStarredModels] = useState<string[]>(DEFAULT_STARRED_MODELS)
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
        throw new Error('Failed to load starred models')
      }
      
      const data = await response.json()
      const loadedStarredModels = data.starredModels || DEFAULT_STARRED_MODELS
      
      // If the loaded starred models is empty or default, it means this is a new user
      // The backend will automatically determine the top 5 models from OpenRouter
      setStarredModels(loadedStarredModels)
      
      if (data.message) {
        console.log('Starred models loaded:', data.message)
      }
    } catch (err) {
      console.error('Error loading starred models:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      // Keep default starred models on error
      setStarredModels(DEFAULT_STARRED_MODELS)
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
        throw new Error('Failed to update starred models')
      }

      const data = await response.json()
      
      // Update with actual response from server
      setStarredModels(data.starredModels || newStarredModels)
    } catch (err) {
      console.error('Error toggling starred model:', err)
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

  return {
    starredModels,
    isStarred,
    toggleStar,
    loading,
    error
  }
} 