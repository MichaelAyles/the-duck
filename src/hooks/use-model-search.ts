import { useState, useCallback } from 'react'
import { logger } from '@/lib/logger'

interface ModelSearchFilters {
  provider?: string
  minContextLength?: number
  maxCostPerToken?: number
  includeFreeTier?: boolean
  capabilities?: string[]
}

interface SearchResult {
  id: string
  name: string
  provider: string
  starred: boolean
  isPrimary: boolean
  context_length?: number
  pricing?: {
    prompt: number
    completion: number
  }
  description?: string
}

interface UseModelSearchReturn {
  searchResults: SearchResult[]
  isLoading: boolean
  error: string | null
  searchModels: (query: string, filters?: ModelSearchFilters) => Promise<void>
  getRecommended: () => Promise<void>
  clearResults: () => void
}

export function useModelSearch(): UseModelSearchReturn {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchModels = useCallback(async (query: string, filters: ModelSearchFilters = {}) => {
    try {
      setIsLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (filters.provider) params.set('provider', filters.provider)
      if (filters.minContextLength) params.set('min_context', filters.minContextLength.toString())
      if (filters.maxCostPerToken) params.set('max_cost', filters.maxCostPerToken.toString())
      if (filters.includeFreeTier !== undefined) params.set('include_free', filters.includeFreeTier.toString())

      const response = await fetch(`/api/search-models?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || 'Failed to search models')
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.details || data.error)
      }

      setSearchResults(data.models || [])
    } catch (err) {
      logger.error('Error searching models:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getRecommended = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/search-models?recommended=true&limit=10')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || 'Failed to get recommended models')
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.details || data.error)
      }

      setSearchResults(data.models || [])
    } catch (err) {
      logger.error('Error getting recommended models:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearResults = useCallback(() => {
    setSearchResults([])
    setError(null)
  }, [])

  return {
    searchResults,
    isLoading,
    error,
    searchModels,
    getRecommended,
    clearResults
  }
}

// Available providers for filtering
export const AVAILABLE_PROVIDERS = [
  'google',
  'deepseek', 
  'anthropic',
  'openai',
  'meta-llama',
  'mistralai',
  'cohere',
  'nvidia',
  'x-ai'
]

// Common context length thresholds
export const CONTEXT_LENGTH_OPTIONS = [
  { label: '4K+', value: 4000 },
  { label: '8K+', value: 8000 },
  { label: '16K+', value: 16000 },
  { label: '32K+', value: 32000 },
  { label: '128K+', value: 128000 },
  { label: '200K+', value: 200000 }
]

// Common cost thresholds (per token)
export const COST_OPTIONS = [
  { label: 'Free', value: 0 },
  { label: 'Under $0.001', value: 0.001 },
  { label: 'Under $0.01', value: 0.01 },
  { label: 'Under $0.1', value: 0.1 },
  { label: 'Any cost', value: undefined }
] 