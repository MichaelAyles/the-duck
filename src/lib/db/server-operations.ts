import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';

/**
 * 🗄️ Server-side Database Operations
 * 
 * Server-side operations that use the server Supabase client with proper authentication context
 * These operations should be used in API routes and server components
 */

// Define UserPreferencesData type locally
export interface UserPreferencesData {
  starredModels: string[]
  primaryModel: string
  theme: 'light' | 'dark' | 'system'
  responseTone: 'friendly' | 'professional' | 'casual' | 'academic' | 'match'
  storageEnabled: boolean
  explicitPreferences: Record<string, any>
  writingStyle: {
    verbosity: 'brief' | 'medium' | 'detailed'
    formality: 'casual' | 'neutral' | 'formal'
    technicalLevel: 'beginner' | 'intermediate' | 'advanced'
    preferredTopics: string[]
    dislikedTopics: string[]
  }
}

/**
 * Get the top 5 models based on OpenRouter rankings
 */
export function getTop5Models(allModels: any[]): string[] {
  if (!Array.isArray(allModels) || allModels.length === 0) {
    return []
  }
  
  return allModels
    .sort((a, b) => {
      // Sort by total_rank (lower is better), then by last_week_rank
      const aRank = a.total_rank || 999999
      const bRank = b.total_rank || 999999
      
      if (aRank !== bRank) {
        return aRank - bRank
      }
      
      // If total_rank is the same, sort by last_week_rank
      const aWeekRank = a.last_week_rank || 999999
      const bWeekRank = b.last_week_rank || 999999
      return aWeekRank - bWeekRank
    })
    .slice(0, 5)
    .map(model => model.id)
}

// Re-export the default preferences and utilities
export const DEFAULT_USER_PREFERENCES: UserPreferencesData = {
  starredModels: ["google/gemini-2.5-flash-preview-05-20", "google/gemini-2.5-pro-preview-05-06", "deepseek/deepseek-chat-v3-0324", "anthropic/claude-sonnet-4", "openai/gpt-4o-mini"],
  primaryModel: "google/gemini-2.5-flash-preview-05-20",
  theme: 'system',
  responseTone: 'match',
  storageEnabled: true,
  explicitPreferences: {},
  writingStyle: {
    verbosity: 'medium',
    formality: 'neutral',
    technicalLevel: 'intermediate',
    preferredTopics: [],
    dislikedTopics: []
  }
};

/**
 * Get user preferences using server-side client with proper authentication context
 */
export async function getUserPreferences(userId: string): Promise<UserPreferencesData> {
  try {
    const supabase = await createClient()
    
    // First check if user is properly authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.warn('No authenticated user found, using defaults')
      return DEFAULT_USER_PREFERENCES
    }

    // Verify the userId matches the authenticated user
    if (user.id !== userId) {
      console.warn('User ID mismatch, using defaults')
      return DEFAULT_USER_PREFERENCES
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!data) {
      console.log('No user preferences found, creating defaults for user:', userId)
      return await createUserPreferencesWithDynamicDefaults(userId)
    }

    return data.preferences as UserPreferencesData
  } catch (error) {
    console.error('Error getting user preferences:', error)
    // Return defaults instead of throwing to prevent app crashes
    return DEFAULT_USER_PREFERENCES
  }
}

/**
 * Create user preferences with dynamic defaults using server-side client
 */
export async function createUserPreferencesWithDynamicDefaults(userId: string): Promise<UserPreferencesData> {
  try {
    // Get dynamic top 5 models from OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const dynamicDefaults = { ...DEFAULT_USER_PREFERENCES }

    if (response.ok) {
      const { data: allModels } = await response.json()
      if (Array.isArray(allModels) && allModels.length > 0) {
        const top5Models = getTop5Models(allModels)
        console.log('Selected top 5 models:', top5Models)
        
        if (top5Models.length > 0) {
          dynamicDefaults.starredModels = top5Models
          dynamicDefaults.primaryModel = top5Models[0]
          console.log('✨ Using dynamic top 5 models for new user:', top5Models)
        }
      }
    }

    return await createUserPreferences(userId, dynamicDefaults)
  } catch (error) {
    console.error('Error creating user preferences with dynamic defaults:', error)
    // Return defaults instead of throwing
    return DEFAULT_USER_PREFERENCES
  }
}

/**
 * Create user preferences using server-side client with authentication check
 */
export async function createUserPreferences(
  userId: string, 
  preferences: UserPreferencesData
): Promise<UserPreferencesData> {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated and matches the userId
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.id !== userId) {
      console.warn('Authentication check failed for createUserPreferences')
      return preferences // Return the preferences without saving
    }

    // Try to upsert to handle race conditions
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preferences: preferences as any
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select('preferences')
      .single()

    if (error) {
      console.error('Failed to create user preferences:', error.message)
      return preferences // Return the preferences without saving
    }

    console.log('Created user preferences for user:', userId)
    return data.preferences as UserPreferencesData
  } catch (error) {
    console.error('Error creating user preferences:', error)
    return preferences // Return the preferences without saving
  }
}

/**
 * Update user preferences using server-side client
 */
export async function updateUserPreferences(
  userId: string, 
  preferences: Partial<UserPreferencesData>
): Promise<UserPreferencesData> {
  try {
    // First get existing preferences
    const existing = await getUserPreferences(userId)
    const updated = { ...existing, ...preferences }

    const supabase = await createClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.id !== userId) {
      console.warn('Authentication check failed for updateUserPreferences')
      return updated
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .update({ preferences: updated as any })
      .eq('user_id', userId)
      .select('preferences')
      .single()

    if (error) {
      console.error('Failed to update user preferences:', error.message)
      return updated
    }

    return data.preferences as UserPreferencesData
  } catch (error) {
    console.error('Error updating user preferences:', error)
    throw error
  }
}

/**
 * Toggle starred model using server-side client
 */
export async function toggleStarredModel(userId: string, modelId: string): Promise<UserPreferencesData> {
  try {
    const preferences = await getUserPreferences(userId)
    const starredModels = [...preferences.starredModels]
    
    const index = starredModels.indexOf(modelId)
    if (index > -1) {
      starredModels.splice(index, 1)
    } else {
      starredModels.push(modelId)
    }
    
    return await updateUserPreferences(userId, { starredModels })
  } catch (error) {
    console.error('Error toggling starred model:', error)
    throw error
  }
}

/**
 * Set primary model using server-side client
 */
export async function setPrimaryModel(userId: string, modelId: string): Promise<UserPreferencesData> {
  try {
    const preferences = await getUserPreferences(userId)
    const starredModels = [...preferences.starredModels]
    
    // Add to starred models if not already there
    if (!starredModels.includes(modelId)) {
      starredModels.push(modelId)
    }
    
    return await updateUserPreferences(userId, { 
      primaryModel: modelId,
      starredModels 
    })
  } catch (error) {
    console.error('Error setting primary model:', error)
    throw error
  }
} 
