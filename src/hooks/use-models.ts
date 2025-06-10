import { useState, useEffect } from 'react'
import { useStarredModels } from './use-starred-models'

interface Model {
  id: string
  name: string
  provider?: string
  starred?: boolean
}

export function useModels() {
  const [curatedModels, setCuratedModels] = useState<Model[]>([])
  const [allModels, setAllModels] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { starredModels, isStarred, toggleStar, loading: starredLoading } = useStarredModels()

  // Fetch curated models on mount
  useEffect(() => {
    const fetchCuratedModels = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/models?type=curated&include_starred=true')
        if (!response.ok) {
          throw new Error('Failed to fetch curated models')
        }
        const data = await response.json()
        
        // Update starred status from our hook
        const modelsWithStarred = (data.models || []).map((model: Model) => ({
          ...model,
          starred: isStarred(model.id)
        }))
        
        setCuratedModels(modelsWithStarred)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        // Fallback to default models if API fails
        setCuratedModels([
          { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', starred: isStarred('openai/gpt-4o-mini') },
          { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', starred: isStarred('openai/gpt-4o') },
          { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', starred: isStarred('anthropic/claude-3.5-sonnet') },
          { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', provider: 'Google', starred: isStarred('google/gemini-flash-1.5') },
          { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)', provider: 'Meta', starred: isStarred('meta-llama/llama-3.1-8b-instruct:free') },
        ])
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
        throw new Error('Failed to fetch all models')
      }
      const data = await response.json()
      
      // Update starred status from our hook
      const modelsWithStarred = (data.models || []).map((model: Model) => ({
        ...model,
        starred: isStarred(model.id)
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
    isStarred,
    toggleStar,
  }
}