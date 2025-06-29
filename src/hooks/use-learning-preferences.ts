import { useState, useEffect, useCallback, useMemo } from 'react'
import { LearningPreference } from '@/lib/learning-preferences'
import { logger } from '@/lib/logger'

// Local interface for the response
interface LearningPreferencesResponse {
  preferences: LearningPreference[]
  summary: {
    total_preferences: number
    strong_likes: number
    strong_dislikes: number
    categories: string[]
    recent_changes: number
  }
}

export interface LearningPreferenceSummary {
  total_preferences: number
  strong_likes: number
  strong_dislikes: number
  categories: string[]
  recent_changes: number
}

export interface UseLearningPreferencesReturn {
  preferences: LearningPreference[]
  summary: LearningPreferenceSummary
  loading: boolean
  error: string | null
  
  // Actions
  loadPreferences: (category?: string, limit?: number, offset?: number) => Promise<void>
  addPreference: (preference: Omit<LearningPreference, 'id' | 'created_at' | 'updated_at' | 'last_reinforced_at'>) => Promise<void>
  updatePreference: (preference: Omit<LearningPreference, 'created_at' | 'updated_at' | 'last_reinforced_at'>) => Promise<void>
  deletePreference: (id: string) => Promise<void>
  bulkUpdatePreferences: (preferences: Partial<LearningPreference>[]) => Promise<void>
  
  // Utility functions
  getPreferencesByCategory: (category: string) => LearningPreference[]
  getPreferenceWeight: (category: string, key: string) => number | null
  getStrongPreferences: (threshold?: number) => { likes: LearningPreference[], dislikes: LearningPreference[] }
}

export function useLearningPreferences(): UseLearningPreferencesReturn {
  const [preferences, setPreferences] = useState<LearningPreference[]>([])
  const [summary, setSummary] = useState<LearningPreferenceSummary>({
    total_preferences: 0,
    strong_likes: 0,
    strong_dislikes: 0,
    categories: [],
    recent_changes: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load preferences from API
  const loadPreferences = useCallback(async (category?: string, limit = 100, offset = 0) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (category) params.append('category', category)
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await fetch(`/api/learning-preferences?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // If table doesn't exist yet, fail silently with empty state
        if (response.status === 500 && (errorData.error?.includes('relation') || errorData.error?.includes('table'))) {
          logger.warn('Learning preferences table not yet deployed, using empty state')
          setPreferences([])
          setSummary({
            total_preferences: 0,
            strong_likes: 0,
            strong_dislikes: 0,
            categories: [],
            recent_changes: 0
          })
          return
        }
        
        throw new Error(errorData.error || 'Failed to load learning preferences')
      }

      const data: LearningPreferencesResponse = await response.json()
      
      setPreferences(data.preferences)
      setSummary(data.summary)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error loading preferences'
      setError(errorMessage)
      logger.error('Error loading learning preferences:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Add a new preference
  const addPreference = useCallback(async (preference: Omit<LearningPreference, 'id' | 'created_at' | 'updated_at' | 'last_reinforced_at'>) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/learning-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preference),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // Provide helpful error message for schema deployment issues
        if (errorData.code === 'SCHEMA_NOT_DEPLOYED') {
          throw new Error('Learning preferences system needs to be deployed. Please contact an administrator.')
        }
        
        throw new Error(errorData.error || 'Failed to add learning preference')
      }

      const data = await response.json()
      
      // Update local state optimistically
      setPreferences(prev => {
        const existingIndex = prev.findIndex(p => 
          p.category === preference.category && p.preference_key === preference.preference_key
        )
        
        if (existingIndex >= 0) {
          // Update existing preference
          const updated = [...prev]
          updated[existingIndex] = data.preference
          return updated
        } else {
          // Add new preference
          return [data.preference, ...prev]
        }
      })

      // Reload to get updated summary
      await loadPreferences()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error adding preference'
      setError(errorMessage)
      logger.error('Error adding learning preference:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [loadPreferences])

  // Update an existing preference
  const updatePreference = useCallback(async (preference: Omit<LearningPreference, 'created_at' | 'updated_at' | 'last_reinforced_at'>) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/learning-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preference),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update learning preference')
      }

      const data = await response.json()
      
      // Update local state
      setPreferences(prev => prev.map(p => 
        p.id === preference.id ? data.preference : p
      ))

      // Reload to get updated summary
      await loadPreferences()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error updating preference'
      setError(errorMessage)
      logger.error('Error updating learning preference:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [loadPreferences])

  // Delete a preference
  const deletePreference = useCallback(async (id: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/learning-preferences?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete learning preference')
      }

      // Update local state
      setPreferences(prev => prev.filter(p => p.id !== id))

      // Reload to get updated summary
      await loadPreferences()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error deleting preference'
      setError(errorMessage)
      logger.error('Error deleting learning preference:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [loadPreferences])

  // Bulk update multiple preferences
  const bulkUpdatePreferences = useCallback(async (preferences: Partial<LearningPreference>[]) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/learning-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to bulk update learning preferences')
      }

      // Reload all preferences after bulk update
      await loadPreferences()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error bulk updating preferences'
      setError(errorMessage)
      logger.error('Error bulk updating learning preferences:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [loadPreferences])

  // Utility: Get preferences by category
  const getPreferencesByCategory = useCallback((category: string): LearningPreference[] => {
    return preferences.filter(p => p.category === category)
  }, [preferences])

  // Utility: Get weight for a specific preference
  const getPreferenceWeight = useCallback((category: string, key: string): number | null => {
    const preference = preferences.find(p => p.category === category && p.preference_key === key)
    return preference ? preference.weight : null
  }, [preferences])

  // Utility: Get strong preferences (above/below threshold)
  const getStrongPreferences = useCallback((threshold = 7) => {
    const likes = preferences.filter(p => p.weight >= threshold)
    const dislikes = preferences.filter(p => p.weight <= -threshold)
    return { likes, dislikes }
  }, [preferences])

  // Load preferences on mount
  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  // Memoize the return object to prevent infinite re-renders
  return useMemo(() => ({
    preferences,
    summary,
    loading,
    error,
    
    // Actions
    loadPreferences,
    addPreference,
    updatePreference,
    deletePreference,
    bulkUpdatePreferences,
    
    // Utilities
    getPreferencesByCategory,
    getPreferenceWeight,
    getStrongPreferences,
  }), [
    preferences,
    summary,
    loading,
    error,
    loadPreferences,
    addPreference,
    updatePreference,
    deletePreference,
    bulkUpdatePreferences,
    getPreferencesByCategory,
    getPreferenceWeight,
    getStrongPreferences,
  ])
}