import { useState, useCallback, useMemo } from 'react'
import { useStarredModels } from './use-starred-models'
import { logger } from '@/lib/logger'

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
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)
  
  // Cache TTL: 5 minutes for models to improve performance
  const MODELS_CACHE_TTL = 5 * 60 * 1000;
  
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

  // Fetch curated models only when explicitly requested with smart caching
  const fetchCuratedModels = useCallback(async (force = false) => {
      // Check cache freshness - avoid fetching if recently loaded
      const now = Date.now();
      if (!force && curatedModels.length > 0 && (now - lastFetchTime) < MODELS_CACHE_TTL) {
        return; // Use cached data for better performance
      }
      
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
        setLastFetchTime(now) // Update cache timestamp
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        // Don't set fallback models - let the UI show the error state
        setCuratedModels([])
      } finally {
        setIsLoading(false)
      }
  }, [isStarred, isActive, curatedModels.length, lastFetchTime, MODELS_CACHE_TTL]) // Enhanced dependencies
  
  // Initialize curated models on first call
  const [hasInitialized, setHasInitialized] = useState(false)
  const initializeCuratedModels = useCallback(async () => {
    if (!hasInitialized) {
      setHasInitialized(true)
      await fetchCuratedModels()
    }
  }, [hasInitialized, fetchCuratedModels])

  const fetchAllModels = useCallback(async (force = false) => {
    // Enhanced caching: check both length and cache age
    const now = Date.now();
    if (!force && allModels.length > 0 && (now - lastFetchTime) < MODELS_CACHE_TTL) {
      return; // Use cached data for better performance
    }

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
      setLastFetchTime(now) // Update cache timestamp
      
      // Log the top 5 models for debugging
      if (data.top5) {
        logger.dev.log('OpenRouter top 5 models:', data.top5)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [allModels.length, isStarred, isActive, lastFetchTime, MODELS_CACHE_TTL])

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