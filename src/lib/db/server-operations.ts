import { createClient } from '@/lib/supabase/server';
import { cache, cacheKeys, CACHE_TTL } from '@/lib/redis';
import { logger } from '@/lib/logger';

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
  explicitPreferences: Record<string, unknown>
  writingStyle: {
    verbosity: 'brief' | 'medium' | 'detailed'
    formality: 'casual' | 'neutral' | 'formal'
    technicalLevel: 'beginner' | 'intermediate' | 'advanced'
    activeTopics: string[]
    avoidedTopics: string[]
  }
}

// Define interface for OpenRouter model data
interface OpenRouterModel {
  id: string;
  total_rank?: number;
  last_week_rank?: number;
}

/**
 * Get the top 5 models based on OpenRouter rankings
 */
export function getTop5Models(allModels: OpenRouterModel[]): string[] {
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
    activeTopics: [],
    avoidedTopics: []
  }
};

/**
 * Get user preferences using server-side client with proper authentication context and Redis caching
 */
export async function getUserPreferences(userId: string): Promise<UserPreferencesData> {
  try {
    // Try to get from cache first
    const cacheKey = cacheKeys.userPreferences(userId);
    const cached = await cache.get<UserPreferencesData>(cacheKey);
    if (cached) {
      return cached;
    }

    const supabase = await createClient()
    
    // First check if user is properly authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('No authenticated user found, using defaults')
      return DEFAULT_USER_PREFERENCES
    }

    // Verify the userId matches the authenticated user
    if (user.id !== userId) {
      logger.warn('User ID mismatch, using defaults')
      return DEFAULT_USER_PREFERENCES
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('starred_models, theme, default_model')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!data) {
      logger.dev.log('No user preferences found, creating defaults for user:', userId)
      return await createUserPreferencesWithDynamicDefaults(userId)
    }

    // Transform SQL columns to API format
    const preferences: UserPreferencesData = {
      ...DEFAULT_USER_PREFERENCES,
      starredModels: data.starred_models || [],
      theme: data.theme || 'system',
      primaryModel: data.default_model || DEFAULT_USER_PREFERENCES.primaryModel
    };
    
    // Cache the preferences
    await cache.set(cacheKey, preferences, CACHE_TTL.USER_PREFERENCES);
    
    return preferences;
  } catch (error) {
    logger.error('Error getting user preferences:', error)
    // Return defaults instead of throwing to prevent app crashes
    return DEFAULT_USER_PREFERENCES
  }
}

/**
 * Create user preferences with dynamic defaults using server-side client
 */
export async function createUserPreferencesWithDynamicDefaults(userId: string): Promise<UserPreferencesData> {
  try {
    // Create defaults first, then enhance with external API if available
    const dynamicDefaults = { ...DEFAULT_USER_PREFERENCES }

    // Separate the external API call from the database transaction
    // to avoid transaction isolation issues
    try {
      // Get dynamic top 5 models from OpenRouter
      // Clean the API key (remove surrounding quotes if present)
      const cleanApiKey = process.env.OPENROUTER_API_KEY?.replace(/^["']|["']$/g, '')
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${cleanApiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const { data: allModels } = await response.json()
        if (Array.isArray(allModels) && allModels.length > 0) {
          const top5Models = getTop5Models(allModels)
          logger.dev.log('Selected top 5 models:', top5Models)
          
          if (top5Models.length > 0) {
            dynamicDefaults.starredModels = top5Models
            dynamicDefaults.primaryModel = top5Models[0]
            logger.dev.log('✨ Using dynamic top 5 models for new user:', top5Models)
          }
        }
      }
    } catch (apiError) {
      logger.warn('Failed to fetch dynamic models, using static defaults:', apiError)
      // Continue with static defaults if API call fails
    }

    // Create preferences with the determined defaults
    return await createUserPreferences(userId, dynamicDefaults)
  } catch (error) {
    logger.error('Error creating user preferences with dynamic defaults:', error)
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
      logger.warn('Authentication check failed for createUserPreferences')
      return preferences // Return the preferences without saving
    }

    // Try to upsert to handle race conditions
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        starred_models: preferences.starredModels,
        theme: preferences.theme,
        default_model: preferences.primaryModel
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select('starred_models, theme, default_model')
      .single()

    if (error) {
      logger.error('Failed to create user preferences:', error.message)
      return preferences // Return the preferences without saving
    }

    // Transform SQL result back to API format
    const apiPreferences: UserPreferencesData = {
      ...preferences,
      starredModels: data.starred_models || [],
      theme: data.theme || 'system',
      primaryModel: data.default_model || preferences.primaryModel
    }
    
    logger.dev.log('Created user preferences for user:', userId)
    return apiPreferences
  } catch (error) {
    logger.error('Error creating user preferences:', error)
    return preferences // Return the preferences without saving
  }
}

/**
 * Update user preferences using server-side client and invalidate cache
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
      logger.warn('Authentication check failed for updateUserPreferences')
      return updated
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .update({
        starred_models: updated.starredModels,
        theme: updated.theme,
        default_model: updated.primaryModel
      })
      .eq('user_id', userId)
      .select('starred_models, theme, default_model')
      .single()

    if (error) {
      logger.error('Failed to update user preferences:', error.message)
      return updated
    }

    // Transform SQL result back to API format
    const newPreferences: UserPreferencesData = {
      ...updated,
      starredModels: data.starred_models || [],
      theme: data.theme || 'system',
      primaryModel: data.default_model || updated.primaryModel
    };
    
    // Invalidate the cache
    const cacheKey = cacheKeys.userPreferences(userId);
    await cache.delete(cacheKey);
    
    // Set the new value in cache
    await cache.set(cacheKey, newPreferences, CACHE_TTL.USER_PREFERENCES);

    return newPreferences;
  } catch (error) {
    logger.error('Error updating user preferences:', error)
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
    logger.error('Error toggling starred model:', error)
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
    logger.error('Error setting primary model:', error)
    throw error
  }
} 
