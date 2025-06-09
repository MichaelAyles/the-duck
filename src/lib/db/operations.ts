import { db } from './index';
import { chatSessions, chatSummaries, type ChatSession, type NewChatSession, type ChatSummary, type NewChatSummary } from './schema';
import { eq, desc, count } from 'drizzle-orm';
import { Message } from '@/components/chat/chat-interface';

/**
 * 🗄️ Database Operations Service
 * 
 * Type-safe database operations using Drizzle ORM
 * Provides a clean interface for chat persistence and retrieval
 */

export class DatabaseService {
  
  /**
   * 💾 Save or update a chat session
   */
  static async saveChatSession(
    sessionId: string,
    title: string,
    messages: Message[],
    model: string
  ): Promise<ChatSession> {
    const sessionData: NewChatSession = {
      id: sessionId,
      title,
      messages: messages as unknown as Record<string, unknown>, // JSONB field
      model,
      isActive: true,
    };

    const [session] = await db
      .insert(chatSessions)
      .values(sessionData)
      .onConflictDoUpdate({
        target: chatSessions.id,
        set: {
          title: sessionData.title,
          messages: sessionData.messages,
          model: sessionData.model,
          updatedAt: new Date(),
        },
      })
      .returning();

    return session;
  }

  /**
   * 📋 Get a chat session by ID
   */
  static async getChatSession(sessionId: string): Promise<ChatSession | null> {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);

    return session || null;
  }

  /**
   * 📚 Get all chat sessions (most recent first)
   */
  static async getAllChatSessions(limit = 50): Promise<ChatSession[]> {
    const sessions = await db
      .select()
      .from(chatSessions)
      .orderBy(desc(chatSessions.createdAt))
      .limit(limit);

    return sessions;
  }

  /**
   * ✅ Mark a chat session as inactive (ended)
   */
  static async endChatSession(sessionId: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ 
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));
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
      sessionId,
      summary,
      keyTopics,
      userPreferences,
      writingStyleAnalysis,
    };

    const [savedSummary] = await db
      .insert(chatSummaries)
      .values(summaryData)
      .onConflictDoUpdate({
        target: chatSummaries.id,
        set: {
          summary: summaryData.summary,
          keyTopics: summaryData.keyTopics,
          userPreferences: summaryData.userPreferences,
          writingStyleAnalysis: summaryData.writingStyleAnalysis,
        },
      })
      .returning();

    return savedSummary;
  }

  /**
   * 📖 Get a chat summary by session ID
   */
  static async getChatSummary(sessionId: string): Promise<ChatSummary | null> {
    const [summary] = await db
      .select()
      .from(chatSummaries)
      .where(eq(chatSummaries.sessionId, sessionId))
      .limit(1);

    return summary || null;
  }

  /**
   * 🗑️ Delete a chat session and its summary
   */
  static async deleteChatSession(sessionId: string): Promise<void> {
    // Delete summary first (due to foreign key constraint)
    await db
      .delete(chatSummaries)
      .where(eq(chatSummaries.sessionId, sessionId));

    // Delete session
    await db
      .delete(chatSessions)
      .where(eq(chatSessions.id, sessionId));
  }

  /**
   * 🔍 Get sessions with their summaries (for advanced queries)
   */
  static async getSessionsWithSummaries(limit = 20): Promise<Array<{
    session: ChatSession;
    summary: ChatSummary | null;
  }>> {
    const sessions = await db
      .select()
      .from(chatSessions)
      .orderBy(desc(chatSessions.createdAt))
      .limit(limit);

    const results = await Promise.all(
      sessions.map(async (session) => {
        const summary = await this.getChatSummary(session.id);
        return { session, summary };
      })
    );

    return results;
  }

  /**
   * 📊 Get database statistics
   */
  static async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalSummaries: number;
  }> {
    // Get total sessions count
    const totalSessionsResult = await db
      .select({ count: count() })
      .from(chatSessions);
    
    // Get active sessions count
    const activeSessionsResult = await db
      .select({ count: count() })
      .from(chatSessions)
      .where(eq(chatSessions.isActive, true));
    
    // Get total summaries count
    const totalSummariesResult = await db
      .select({ count: count() })
      .from(chatSummaries);

    return {
      totalSessions: totalSessionsResult[0]?.count || 0,
      activeSessions: activeSessionsResult[0]?.count || 0,
      totalSummaries: totalSummariesResult[0]?.count || 0,
    };
  }
} 