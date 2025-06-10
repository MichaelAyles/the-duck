import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { Message } from '@/components/chat/chat-interface';

/**
 * 🗄️ Supabase Database Operations Service
 * 
 * Pure Supabase client operations for chat persistence and retrieval
 * Replaces Drizzle ORM with Supabase's built-in database client
 */

// Create Supabase client for server-side operations
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type ChatSession = Database['public']['Tables']['chat_sessions']['Row'];
export type NewChatSession = Database['public']['Tables']['chat_sessions']['Insert'];
export type ChatSummary = Database['public']['Tables']['chat_summaries']['Row'];
export type NewChatSummary = Database['public']['Tables']['chat_summaries']['Insert'];

export class SupabaseDatabaseService {
  
  /**
   * 💾 Save or update a chat session
   */
  static async saveChatSession(
    sessionId: string,
    title: string,
    messages: Message[],
    model: string,
    userId?: string
  ): Promise<ChatSession> {
    const sessionData: NewChatSession = {
      id: sessionId,
      title,
      messages: messages as any, // Supabase handles JSONB automatically
      model,
      is_active: true,
      user_id: userId || null,
    };

    const { data, error } = await supabase
      .from('chat_sessions')
      .upsert(sessionData, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving chat session:', error);
      throw new Error(`Failed to save chat session: ${error.message}`);
    }

    return data;
  }

  /**
   * 📋 Get a chat session by ID
   */
  static async getChatSession(sessionId: string, userId?: string): Promise<ChatSession | null> {
    let query = supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId);

    // If userId is provided, filter by user
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Error getting chat session:', error);
      throw new Error(`Failed to get chat session: ${error.message}`);
    }

    return data;
  }

  /**
   * 📚 Get all chat sessions for a user (most recent first)
   */
  static async getAllChatSessions(userId?: string, limit = 50): Promise<ChatSession[]> {
    let query = supabase
      .from('chat_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // If userId is provided, filter by user
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting chat sessions:', error);
      throw new Error(`Failed to get chat sessions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * ✅ Mark a chat session as inactive (ended)
   */
  static async endChatSession(sessionId: string, userId?: string): Promise<void> {
    let query = supabase
      .from('chat_sessions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // If userId is provided, ensure user owns the session
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      console.error('Error ending chat session:', error);
      throw new Error(`Failed to end chat session: ${error.message}`);
    }
  }

  /**
   * 📝 Save a chat summary
   */
  static async saveChatSummary(
    summaryId: string,
    sessionId: string,
    summary: string,
    keyTopics: string[],
    userPreferences: Record<string, unknown>,
    writingStyleAnalysis: Record<string, unknown>
  ): Promise<ChatSummary> {
    const summaryData: NewChatSummary = {
      id: summaryId,
      session_id: sessionId,
      summary,
      key_topics: keyTopics,
      user_preferences: userPreferences as any,
      writing_style_analysis: writingStyleAnalysis as any,
    };

    const { data, error } = await supabase
      .from('chat_summaries')
      .upsert(summaryData, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving chat summary:', error);
      throw new Error(`Failed to save chat summary: ${error.message}`);
    }

    return data;
  }

  /**
   * 📖 Get a chat summary by session ID
   */
  static async getChatSummary(sessionId: string): Promise<ChatSummary | null> {
    const { data, error } = await supabase
      .from('chat_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Error getting chat summary:', error);
      throw new Error(`Failed to get chat summary: ${error.message}`);
    }

    return data;
  }

  /**
   * 🗑️ Delete a chat session and its summary
   */
  static async deleteChatSession(sessionId: string, userId?: string): Promise<void> {
    // First delete the summary (foreign key will handle cascade, but let's be explicit)
    await supabase
      .from('chat_summaries')
      .delete()
      .eq('session_id', sessionId);

    // Then delete the session
    let query = supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    // If userId is provided, ensure user owns the session
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting chat session:', error);
      throw new Error(`Failed to delete chat session: ${error.message}`);
    }
  }

  /**
   * 🔍 Get sessions with their summaries (for advanced queries)
   */
  static async getSessionsWithSummaries(userId?: string, limit = 20): Promise<Array<{
    session: ChatSession;
    summary: ChatSummary | null;
  }>> {
    let query = supabase
      .from('chat_sessions')
      .select(`
        *,
        chat_summaries (*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // If userId is provided, filter by user
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting sessions with summaries:', error);
      throw new Error(`Failed to get sessions with summaries: ${error.message}`);
    }

    return (data || []).map(item => ({
      session: {
        id: item.id,
        title: item.title,
        messages: item.messages,
        model: item.model,
        created_at: item.created_at,
        updated_at: item.updated_at,
        is_active: item.is_active,
        user_id: item.user_id,
      },
      summary: Array.isArray(item.chat_summaries) && item.chat_summaries.length > 0 
        ? item.chat_summaries[0] 
        : null,
    }));
  }

  /**
   * 📊 Get database statistics
   */
  static async getStats(userId?: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalSummaries: number;
  }> {
    // Build base queries
    let sessionsQuery = supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true });

    let activeSessionsQuery = supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    let summariesQuery = supabase
      .from('chat_summaries')
      .select('*', { count: 'exact', head: true });

    // If userId is provided, filter by user
    if (userId) {
      sessionsQuery = sessionsQuery.eq('user_id', userId);
      activeSessionsQuery = activeSessionsQuery.eq('user_id', userId);
      
      // For summaries, we need to join with sessions to filter by user
      summariesQuery = supabase
        .from('chat_summaries')
        .select('*, chat_sessions!inner(user_id)', { count: 'exact', head: true })
        .eq('chat_sessions.user_id', userId);
    }

    const [totalSessionsResult, activeSessionsResult, totalSummariesResult] = await Promise.all([
      sessionsQuery,
      activeSessionsQuery,
      summariesQuery,
    ]);

    if (totalSessionsResult.error || activeSessionsResult.error || totalSummariesResult.error) {
      console.error('Error getting stats:', {
        totalSessions: totalSessionsResult.error,
        activeSessions: activeSessionsResult.error,
        totalSummaries: totalSummariesResult.error,
      });
      throw new Error('Failed to get database statistics');
    }

    return {
      totalSessions: totalSessionsResult.count || 0,
      activeSessions: activeSessionsResult.count || 0,
      totalSummaries: totalSummariesResult.count || 0,
    };
  }

  /**
   * 🔍 Search chat sessions by title or content
   */
  static async searchChatSessions(
    searchTerm: string,
    userId?: string,
    limit = 20
  ): Promise<ChatSession[]> {
    let query = supabase
      .from('chat_sessions')
      .select('*')
      .or(`title.ilike.%${searchTerm}%,messages::text.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    // If userId is provided, filter by user
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error searching chat sessions:', error);
      throw new Error(`Failed to search chat sessions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 📈 Get user activity summary
   */
  static async getUserActivity(userId: string): Promise<{
    totalChats: number;
    activeChats: number;
    totalMessages: number;
    favoriteModels: Array<{ model: string; count: number }>;
    recentActivity: ChatSession[];
  }> {
    // Get basic stats
    const stats = await this.getStats(userId);
    
    // Get recent sessions for activity
    const recentSessions = await this.getAllChatSessions(userId, 10);
    
    // Calculate total messages and favorite models
    const allSessions = await this.getAllChatSessions(userId, 1000); // Get more for analysis
    
    const totalMessages = allSessions.reduce((total, session) => {
      const messages = Array.isArray(session.messages) ? session.messages : [];
      return total + messages.length;
    }, 0);

    // Count model usage
    const modelCounts = allSessions.reduce((counts, session) => {
      counts[session.model] = (counts[session.model] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const favoriteModels = Object.entries(modelCounts)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalChats: stats.totalSessions,
      activeChats: stats.activeSessions,
      totalMessages,
      favoriteModels,
      recentActivity: recentSessions,
    };
  }
}

/**
 * 👤 User Preferences Operations
 */
export interface UserPreferencesData {
  starredModels: string[]
  primaryModel: string
  theme: 'light' | 'dark' | 'system'
  responseTone: 'match' | 'professional' | 'casual' | 'concise' | 'detailed'
  storageEnabled: boolean
  explicitPreferences: Record<string, unknown>
  writingStyle?: {
    verbosity: 'short' | 'medium' | 'long'
    formality: 'casual' | 'neutral' | 'formal'
    technicalLevel: 'basic' | 'intermediate' | 'advanced'
    preferredTopics: string[]
    dislikedTopics: string[]
  }
}

/**
 * 🌟 Top Models Selection Logic
 * Determines top 5 models based on OpenRouter criteria
 */
export function getTop5Models(allModels: any[]): string[] {
  if (!allModels || allModels.length === 0) {
    // Fallback to our curated default list if no models available
    return DEFAULT_STARRED_MODELS
  }

  // Define our curated top models based on performance and capabilities
  const curatedTopModels = [
    'google/gemini-2.5-flash-preview-05-20',
    'google/gemini-2.5-pro-preview-05-06', 
    'deepseek/deepseek-chat-v3-0324',
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o-mini',
    // Additional high-quality models for fallback
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-flash-1.5',
    'google/gemini-pro-1.5',
    'meta-llama/llama-3.1-405b-instruct',
    'meta-llama/llama-3.1-70b-instruct',
    'anthropic/claude-3-haiku',
    'openai/gpt-3.5-turbo'
  ]

  // Filter available models to only include ones that exist in OpenRouter
  const availableModelIds = allModels.map((model: any) => model.id)
  const availableTopModels = curatedTopModels.filter((modelId: string) => 
    availableModelIds.includes(modelId)
  )

  // If we have at least 5 top models available, return top 5
  if (availableTopModels.length >= 5) {
    return availableTopModels.slice(0, 5)
  }

  // Otherwise, supplement with other available models using parametric search
  // Prioritize by factors: performance, capabilities, cost-effectiveness
  const remainingModels = allModels
    .filter((model: any) => !availableTopModels.includes(model.id))
    .sort((a: any, b: any) => {
      // Prioritize non-free models for better performance
      const aIsFree = a.id.includes(':free') || (a.pricing?.prompt === 0 && a.pricing?.completion === 0)
      const bIsFree = b.id.includes(':free') || (b.pricing?.prompt === 0 && b.pricing?.completion === 0)
      
      if (aIsFree !== bIsFree) {
        return aIsFree ? 1 : -1
      }
      
      // Prioritize by context length (higher is better for versatility)
      const contextDiff = (b.context_length || 0) - (a.context_length || 0)
      if (contextDiff !== 0) {
        return contextDiff
      }
      
      // Prioritize known high-performance providers
      const providerScore = (model: any) => {
        const provider = model.id.split('/')[0]
        const providerRanks: { [key: string]: number } = {
          'anthropic': 9,
          'openai': 8,
          'google': 7,
          'deepseek': 6,
          'meta-llama': 5,
          'mistralai': 4
        }
        return providerRanks[provider] || 0
      }
      
      const providerDiff = providerScore(b) - providerScore(a)
      if (providerDiff !== 0) {
        return providerDiff
      }
      
      // Finally alphabetically
      return a.name.localeCompare(b.name)
    })
    .map((model: any) => model.id)

  // Combine and take top 5
  const top5 = [...availableTopModels, ...remainingModels].slice(0, 5)
  
  console.log('Selected top 5 models:', top5)
  return top5
}

export const DEFAULT_STARRED_MODELS = [
  'google/gemini-2.5-flash-preview-05-20',
  'google/gemini-2.5-pro-preview-05-06',
  'deepseek/deepseek-chat-v3-0324',
  'anthropic/claude-sonnet-4',
  'openai/gpt-4o-mini'
]

export const DEFAULT_USER_PREFERENCES: UserPreferencesData = {
  starredModels: DEFAULT_STARRED_MODELS,
  primaryModel: DEFAULT_STARRED_MODELS[0], // First model in starred list as default primary
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
}

export async function getUserPreferences(userId: string): Promise<UserPreferencesData> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found, create default preferences with dynamic top 5
        console.log('No user preferences found, creating defaults for user:', userId)
        return await createUserPreferencesWithDynamicDefaults(userId)
      }
      throw new Error(`Failed to get user preferences: ${error.message}`)
    }

    return data.preferences as UserPreferencesData
  } catch (error) {
    console.error('Error getting user preferences:', error)
    throw error // Don't fallback, let the caller handle the error
  }
}

export async function createUserPreferencesWithDynamicDefaults(userId: string): Promise<UserPreferencesData> {
  try {
    // Fetch all models to determine top 5 - no fallback
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key not configured - cannot determine top models')
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models from OpenRouter: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const starredModels = getTop5Models(data.data || [])
    console.log('Using dynamic top 5 models:', starredModels)

    const defaultPrefs: UserPreferencesData = {
      ...DEFAULT_USER_PREFERENCES,
      starredModels,
      primaryModel: starredModels[0] || DEFAULT_STARRED_MODELS[0]
    }

    return await createUserPreferences(userId, defaultPrefs)
  } catch (error) {
    console.error('Error creating user preferences with dynamic defaults:', error)
    throw error
  }
}

export async function createUserPreferences(
  userId: string, 
  preferences: UserPreferencesData
): Promise<UserPreferencesData> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .insert([{
        user_id: userId,
        preferences: preferences
      }])
      .select('preferences')
      .single()

    if (error) {
      throw new Error(`Failed to create user preferences: ${error.message}`)
    }

    console.log('Created user preferences for user:', userId)
    return data.preferences as UserPreferencesData
  } catch (error) {
    console.error('Error creating user preferences:', error)
    throw error
  }
}

export async function updateUserPreferences(
  userId: string, 
  preferences: Partial<UserPreferencesData>
): Promise<UserPreferencesData> {
  try {
    // First get current preferences
    const currentPrefs = await getUserPreferences(userId)
    
    // Merge with new preferences
    const updatedPrefs = {
      ...currentPrefs,
      ...preferences,
      writingStyle: {
        ...currentPrefs.writingStyle,
        ...preferences.writingStyle
      }
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .update({
        preferences: updatedPrefs
      })
      .eq('user_id', userId)
      .select('preferences')
      .single()

    if (error) {
      throw new Error(`Failed to update user preferences: ${error.message}`)
    }

    console.log('Updated user preferences for user:', userId)
    return data.preferences as UserPreferencesData
  } catch (error) {
    console.error('Error updating user preferences:', error)
    throw error
  }
}

export async function toggleStarredModel(userId: string, modelId: string): Promise<UserPreferencesData> {
  try {
    const currentPrefs = await getUserPreferences(userId)
    const starredModels = [...currentPrefs.starredModels]
    
    if (starredModels.includes(modelId)) {
      // Remove from starred models
      const index = starredModels.indexOf(modelId)
      starredModels.splice(index, 1)
    } else {
      // Add to starred models
      starredModels.push(modelId)
    }

    return await updateUserPreferences(userId, { starredModels })
  } catch (error) {
    console.error('Error toggling starred model:', error)
    throw error
  }
}

/**
 * Set the user's primary model (their default selection)
 */
export async function setPrimaryModel(userId: string, modelId: string): Promise<UserPreferencesData> {
  try {
    // Ensure the model is in starred models when set as primary
    const currentPrefs = await getUserPreferences(userId)
    const starredModels = [...currentPrefs.starredModels]
    
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

/**
 * Enhanced model search with parametric filtering
 */
export function searchModels(
  allModels: any[], 
  searchQuery: string, 
  filters: {
    provider?: string
    minContextLength?: number
    maxCostPerToken?: number
    includeFreeTier?: boolean
    capabilities?: string[]
  } = {}
): any[] {
  if (!allModels || allModels.length === 0) {
    return []
  }

  let filteredModels = allModels

  // Text search
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    filteredModels = filteredModels.filter((model: any) => 
      model.name.toLowerCase().includes(query) ||
      model.id.toLowerCase().includes(query) ||
      (model.description && model.description.toLowerCase().includes(query))
    )
  }

  // Provider filter
  if (filters.provider) {
    filteredModels = filteredModels.filter((model: any) => 
      model.id.startsWith(filters.provider + '/')
    )
  }

  // Context length filter
  if (filters.minContextLength !== undefined) {
    filteredModels = filteredModels.filter((model: any) => 
      (model.context_length || 0) >= filters.minContextLength!
    )
  }

  // Cost filter (approximate based on pricing structure)
  if (filters.maxCostPerToken !== undefined) {
    filteredModels = filteredModels.filter((model: any) => {
      if (!model.pricing) return true // Include models without pricing info
      const promptCost = model.pricing.prompt || 0
      const completionCost = model.pricing.completion || 0
      const avgCost = (promptCost + completionCost) / 2
      return avgCost <= filters.maxCostPerToken!
    })
  }

  // Free tier filter
  if (filters.includeFreeTier === false) {
    filteredModels = filteredModels.filter((model: any) => 
      !model.id.includes(':free') && 
      !(model.pricing?.prompt === 0 && model.pricing?.completion === 0)
    )
  } else if (filters.includeFreeTier === true) {
    // Only show free models
    filteredModels = filteredModels.filter((model: any) => 
      model.id.includes(':free') || 
      (model.pricing?.prompt === 0 && model.pricing?.completion === 0)
    )
  }

  // Sort by relevance and quality
  return filteredModels.sort((a: any, b: any) => {
    // Prioritize our curated top models
    const isACurated = DEFAULT_STARRED_MODELS.includes(a.id)
    const isBCurated = DEFAULT_STARRED_MODELS.includes(b.id)
    
    if (isACurated !== isBCurated) {
      return isACurated ? -1 : 1
    }

    // Then by context length (higher is better)
    const contextDiff = (b.context_length || 0) - (a.context_length || 0)
    if (contextDiff !== 0) {
      return contextDiff
    }

    // Then by provider ranking
    const providerScore = (model: any) => {
      const provider = model.id.split('/')[0]
      const providerRanks: { [key: string]: number } = {
        'google': 10,
        'deepseek': 9,
        'anthropic': 8,
        'openai': 7,
        'meta-llama': 6,
        'mistralai': 5
      }
      return providerRanks[provider] || 0
    }
    
    const providerDiff = providerScore(b) - providerScore(a)
    if (providerDiff !== 0) {
      return providerDiff
    }

    // Finally alphabetically
    return a.name.localeCompare(b.name)
  })
}

/**
 * Get recommended models based on user activity and preferences
 */
export async function getRecommendedModels(
  userId: string, 
  allModels: any[], 
  limit: number = 10
): Promise<any[]> {
  try {
    const preferences = await getUserPreferences(userId)
    const userActivity = await SupabaseDatabaseService.getUserActivity(userId)
    
    // Get user's favorite models from their chat history
    const usedModels = userActivity.favoriteModels.map(fav => fav.model)
    
    // Combine starred models and frequently used models
    const preferredModels = [...new Set([...preferences.starredModels, ...usedModels])]
    
    // Filter available models
    const availablePreferred = allModels.filter((model: any) => 
      preferredModels.includes(model.id)
    )
    
    // Add similar models based on provider and capabilities
    const similarModels = allModels.filter((model: any) => {
      if (preferredModels.includes(model.id)) return false
      
      // Find models from same providers as preferred models
      const providers = preferredModels.map(id => id.split('/')[0])
      return providers.includes(model.id.split('/')[0])
    })
    
    // Combine and limit results
    const recommended = [...availablePreferred, ...similarModels].slice(0, limit)
    
    return recommended.sort((a: any, b: any) => {
      // Prioritize starred models
      const aStarred = preferences.starredModels.includes(a.id)
      const bStarred = preferences.starredModels.includes(b.id)
      
      if (aStarred !== bStarred) {
        return aStarred ? -1 : 1
      }
      
      // Then by usage frequency
      const aUsage = userActivity.favoriteModels.find(fav => fav.model === a.id)?.count || 0
      const bUsage = userActivity.favoriteModels.find(fav => fav.model === b.id)?.count || 0
      
      return bUsage - aUsage
    })
  } catch (error) {
    console.error('Error getting recommended models:', error)
    // Fallback to default starred models
    return allModels.filter((model: any) => 
      DEFAULT_STARRED_MODELS.includes(model.id)
    ).slice(0, limit)
  }
} 