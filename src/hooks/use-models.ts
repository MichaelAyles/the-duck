import { useState, useCallback, useMemo } from 'react'
import { useStarredModels } from './use-starred-models'

interface Model {
  id: string
  name: string
  provider?: string
  starred?: boolean
  isActive?: boolean
  pricing?: {
    prompt?: number
    completion?: number
    currency?: string
  }
  context_length?: number
  description?: string
  latency?: {
    p50?: number // 50th percentile latency in ms
    p95?: number // 95th percentile latency in ms
  }
}

export function useModels() {
  const [curatedModels, setCuratedModels] = useState<Model[]>([])
  const [allModels, setAllModels] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { 
    starredModels, 
    activeModel, 
    isStarred, 
    isActive, 
    toggleStar, 
    setActive, 
    resetToDefaults,
    loading: starredLoading 
  } = useStarredModels()

  // Fetch curated models only when explicitly requested
  const fetchCuratedModels = useCallback(async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/models?type=curated&include_starred=true')
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.details || errorData.error || 'Failed to fetch curated models')
        }
        const data = await response.json()
        
        // Check if the response contains an error (even with 200 status)
        if (data.error) {
          throw new Error(data.details || data.error)
        }
        
        // Update starred status and active status from our hook
        const modelsWithStarred = (data.models || []).map((model: Model) => ({
          ...model,
          starred: isStarred(model.id),
          isActive: isActive(model.id)
        }))
        
        setCuratedModels(modelsWithStarred)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        // Don't set fallback models - let the UI show the error state
        setCuratedModels([])
      } finally {
        setIsLoading(false)
      }
  }, [isStarred, isActive]) // Dependencies for the callback
  
  // Initialize curated models on first call
  const [hasInitialized, setHasInitialized] = useState(false)
  const initializeCuratedModels = useCallback(async () => {
    if (!hasInitialized) {
      setHasInitialized(true)
      await fetchCuratedModels()
    }
  }, [hasInitialized, fetchCuratedModels])

  const fetchAllModels = useCallback(async () => {
    if (allModels.length > 0) return // Already fetched

    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/models?type=all&include_starred=true')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || 'Failed to fetch all models')
      }
      const data = await response.json()
      
      // Check if the response contains an error (even with 200 status)
      if (data.error) {
        throw new Error(data.details || data.error)
      }
      
      // Update starred status and active status from our hook
      const modelsWithStarred = (data.models || []).map((model: Model) => ({
        ...model,
        starred: isStarred(model.id),
        isActive: isActive(model.id)
      }))
      
      setAllModels(modelsWithStarred)
      
      // Log the top 5 models for debugging
      if (data.top5) {
        console.log('OpenRouter top 5 models:', data.top5)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [allModels.length, isStarred, isActive])

  // Memoize the return object to prevent infinite re-renders
  return useMemo(() => ({
    curatedModels,
    allModels,
    isLoading: isLoading || starredLoading,
    error,
    fetchAllModels,
    initializeCuratedModels,
    // Starred model functionality
    starredModels,
    activeModel,
    isStarred,
    isActive,
    toggleStar,
    setActive,
    resetToDefaults,
  }), [
    curatedModels,
    allModels,
    isLoading,
    starredLoading,
    error,
    fetchAllModels,
    initializeCuratedModels,
    starredModels,
    activeModel,
    isStarred,
    isActive,
    toggleStar,
    setActive,
    resetToDefaults,
  ])
}