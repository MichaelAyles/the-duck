import { useState, useEffect } from 'react'
import { useStarredModels } from './use-starred-models'

interface Model {
  id: string
  name: string
  provider?: string
  starred?: boolean
  isPrimary?: boolean
}

export function useModels() {
  const [curatedModels, setCuratedModels] = useState<Model[]>([])
  const [allModels, setAllModels] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { 
    starredModels, 
    primaryModel, 
    isStarred, 
    isPrimary, 
    toggleStar, 
    setPrimary, 
    loading: starredLoading 
  } = useStarredModels()

  // Fetch curated models on mount
  useEffect(() => {
    const fetchCuratedModels = async () => {
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
        
        // Update starred status and primary status from our hook
        const modelsWithStarred = (data.models || []).map((model: Model) => ({
          ...model,
          starred: isStarred(model.id),
          isPrimary: isPrimary(model.id)
        }))
        
        setCuratedModels(modelsWithStarred)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        // Don't set fallback models - let the UI show the error state
        setCuratedModels([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchCuratedModels()
  }, [starredModels, isStarred]) // Re-fetch when starred models change

  const fetchAllModels = async () => {
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
      
      // Update starred status and primary status from our hook
      const modelsWithStarred = (data.models || []).map((model: Model) => ({
        ...model,
        starred: isStarred(model.id),
        isPrimary: isPrimary(model.id)
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
  }

  return {
    curatedModels,
    allModels,
    isLoading: isLoading || starredLoading,
    error,
    fetchAllModels,
    // Starred model functionality
    starredModels,
    primaryModel,
    isStarred,
    isPrimary,
    toggleStar,
    setPrimary,
  }
}