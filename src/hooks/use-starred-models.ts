import { useState, useEffect, useCallback } from 'react'

const DEFAULT_STARRED_MODELS = [
  'google/gemini-2.5-flash-preview-05-20',
  'google/gemini-2.5-pro-preview-05-06',
  'deepseek/deepseek-chat-v3-0324',
  'anthropic/claude-sonnet-4',
  'openai/gpt-4o-mini'
]

export interface UseStarredModelsReturn {
  starredModels: string[]
  primaryModel: string
  isStarred: (modelId: string) => boolean
  isPrimary: (modelId: string) => boolean
  toggleStar: (modelId: string) => Promise<void>
  setPrimary: (modelId: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function useStarredModels(): UseStarredModelsReturn {
  const [starredModels, setStarredModels] = useState<string[]>(DEFAULT_STARRED_MODELS)
  const [primaryModel, setPrimaryModelState] = useState<string>(DEFAULT_STARRED_MODELS[0])
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
      setPrimaryModelState(data.primaryModel || DEFAULT_STARRED_MODELS[0])
      
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
      if (data.primaryModel) {
        setPrimaryModelState(data.primaryModel)
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

  const setPrimary = useCallback(async (modelId: string) => {
    if (!modelId) return

    try {
      setLoading(true)
      setError(null)

      // Optimistic update
      setPrimaryModelState(modelId)

      // Persist to backend
      const response = await fetch('/api/starred-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId,
          action: 'set_primary'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || 'Failed to set primary model')
      }

      const data = await response.json()
      
      // Check if the response contains an error (even with 200 status)
      if (data.error) {
        throw new Error(data.details || data.error)
      }
      
      // Update with actual response from server
      setStarredModels(data.starredModels || starredModels)
      setPrimaryModelState(data.primaryModel || modelId)
    } catch (err) {
      console.error('Error setting primary model:', err)
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

  const isPrimary = useCallback((modelId: string): boolean => {
    return primaryModel === modelId
  }, [primaryModel])

  return {
    starredModels,
    primaryModel,
    isStarred,
    isPrimary,
    toggleStar,
    setPrimary,
    loading,
    error
  }
} 