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