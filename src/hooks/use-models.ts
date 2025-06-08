import { useState, useEffect } from 'react'

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

  // Fetch curated models on mount
  useEffect(() => {
    const fetchCuratedModels = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/models?type=curated')
        if (!response.ok) {
          throw new Error('Failed to fetch curated models')
        }
        const data = await response.json()
        setCuratedModels(data.models || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        // Fallback to default models if API fails
        setCuratedModels([
          { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', starred: true },
          { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', starred: true },
          { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', starred: true },
          { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', provider: 'Google', starred: true },
          { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)', provider: 'Meta', starred: true },
        ])
      } finally {
        setIsLoading(false)
      }
    }

    fetchCuratedModels()
  }, [])

  const fetchAllModels = async () => {
    if (allModels.length > 0) return // Already fetched

    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/models?type=all')
      if (!response.ok) {
        throw new Error('Failed to fetch all models')
      }
      const data = await response.json()
      setAllModels(data.models || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    curatedModels,
    allModels,
    isLoading,
    error,
    fetchAllModels,
  }
}