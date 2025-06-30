import { Message } from '@/types/chat'
import { nanoid } from 'nanoid'
import { logger } from '@/lib/logger'

const INACTIVITY_TIMEOUT = 10 * 60 * 1000 // 10 minutes in milliseconds

interface SessionData {
  id: string
  title: string
  created_at: string
  updated_at: string
  is_active: boolean
  messages: Message[]
  model: string
}

export interface ChatSummary {
  summary: string
  keyTopics: string[]
  userPreferences: {
    explicit: Record<string, unknown>
    implicit: {
      writingStyle: {
        formality: number
        verbosity: number
        technicalLevel: number
        activeResponseLength: number
      }
    }
  }
}

export class ChatService {
  private sessionId: string
  private userId?: string
  private inactivityTimer?: NodeJS.Timeout

  constructor(sessionId?: string, userId?: string) {
    this.sessionId = sessionId || nanoid()
    this.userId = userId
  }

  public getSessionId(): string {
    return this.sessionId
  }

  public setUserId(userId: string): void {
    this.userId = userId
  }

  public setupInactivityHandler(onSummarize: () => void) {
    this.clearInactivityTimer()
    
    this.inactivityTimer = setTimeout(() => {
      onSummarize()
    }, INACTIVITY_TIMEOUT)
  }

  public clearInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer)
      this.inactivityTimer = undefined
    }
  }

  public async saveChatSession(messages: Message[], model: string, title?: string) {
    // Don't save if no user is authenticated
    if (!this.userId) {
      logger.dev.log('Skipping chat session save - no user authenticated')
      return
    }

    // Use provided title or default to 'New Chat' - title generation now handled by dedicated API
    const sessionTitle = title || 'New Chat'
    
    // Implement retry logic for critical session saves
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: this.sessionId,
            title: sessionTitle,
            messages,
            model,
          }),
        })

        if (response.ok) {
          logger.dev.log(`✅ Session ${this.sessionId} saved successfully on attempt ${attempt}`)
          return // Success - exit retry loop
        }

        const error = await response.json()
        throw new Error(error.error || `HTTP ${response.status}: Failed to save chat session`)
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt < maxRetries) {
          // Wait before retrying: 200ms, 400ms, 800ms
          const delay = 200 * Math.pow(2, attempt - 1);
          logger.dev.log(`⚠️ Session save failed (attempt ${attempt}/${maxRetries}):`, error, `- retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
    }
    
    // If we get here, all retries failed - this is critical
    logger.error(`❌ CRITICAL: Failed to save session ${this.sessionId} after ${maxRetries} attempts:`, lastError)
    throw lastError || new Error('Failed to save session after all retries')
  }

  public async loadChatSession(): Promise<Message[]> {
    try {
      if (!this.userId) {
        logger.dev.log('No user ID available for loading session')
        return []
      }

      logger.dev.log(`Loading session ${this.sessionId} for user ${this.userId}`);
      
      // Retry logic to handle race conditions between session creation and retrieval
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(`/api/sessions/${this.sessionId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (response.ok) {
            const data = await response.json()
            const session = data.session
            logger.dev.log(`✅ Session ${this.sessionId} loaded successfully on attempt ${attempt}`)
            return this.parseSessionMessages(session)
          }
          
          if (response.status === 404) {
            if (attempt < maxRetries) {
              // Wait before retrying: 100ms, 200ms, 400ms
              const delay = 100 * Math.pow(2, attempt - 1);
              logger.dev.log(`⏳ Session ${this.sessionId} not found (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay))
              continue
            } else {
              logger.dev.log(`❌ Session ${this.sessionId} not found after ${maxRetries} attempts`)
              return []
            }
          }
          
          // Other HTTP errors
          throw new Error(`HTTP ${response.status}: Failed to load chat session`)
          
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error')
          if (attempt < maxRetries) {
            const delay = 100 * Math.pow(2, attempt - 1);
            logger.dev.log(`⚠️ Error loading session (attempt ${attempt}/${maxRetries}):`, error, `- retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }
      }
      
      // If we get here, all retries failed
      throw lastError || new Error('Failed to load session after all retries')
      
    } catch (error) {
      logger.dev.warn('Failed to load chat session:', error)
      return []
    }
  }

  private parseSessionMessages(session: { messages?: unknown[] }): Message[] {
    if (session && Array.isArray(session.messages)) {
      logger.dev.log(`Found ${session.messages.length} messages in session ${this.sessionId}`)
      return session.messages as Message[]
    }
    
    logger.dev.log(`No messages found for session ${this.sessionId}`);
    return []
  }

  public async summarizeChat(messages: Message[]): Promise<ChatSummary> {
    try {
      // Use a cost-effective model for summarization
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages,
          sessionId: this.sessionId 
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to summarize chat')
      }

      const summary = await response.json()

      // Note: The summarize API should handle saving the summary to the database
      // This keeps the client-side code simpler and more secure

      return summary
    } catch (error) {
      logger.dev.warn('Chat summarization failed (storage may be disabled):', error)
      
      // Return a default summary in case of failure
      return {
        summary: 'Chat session completed',
        keyTopics: [],
        userPreferences: {
          explicit: {},
          implicit: {
            writingStyle: {
              formality: 0.5,
              verbosity: 0.5,
              technicalLevel: 0.5,
              activeResponseLength: 0.5
            }
          }
        }
      }
    }
  }

  public async getCurrentSessionTitle(): Promise<string | null> {
    try {
      if (!this.userId) {
        return null;
      }

      const response = await fetch(`/api/sessions/${this.sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.session?.title || null;
      }
      
      return null;
    } catch (error) {
      logger.dev.warn('Failed to get session title:', error);
      return null;
    }
  }

  public async endChatSession(): Promise<void> {
    try {
      const response = await fetch(`/api/sessions/${this.sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: false,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to end chat session')
      }

      this.clearInactivityTimer()
    } catch (error) {
      logger.dev.warn('Failed to end chat session:', error)
    }
  }

  public async summarizeAndEndChat(messages: Message[]): Promise<ChatSummary> {
    try {
      const summary = await this.summarizeChat(messages)
      await this.endChatSession()
      return summary
    } catch (error) {
      logger.error('Failed to summarize and end chat:', error)
      await this.endChatSession() // Still try to end the session
      throw error
    }
  }


  public async getUserChatHistory(limit = 20): Promise<Array<{
    id: string
    title: string
    createdAt: string
    messageCount: number
    isActive: boolean
  }>> {
    try {
      if (!this.userId) {
        return []
      }

      const response = await fetch(`/api/sessions?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load chat history')
      }

      const data = await response.json()
      const sessions = data.sessions || []
      
      return sessions.map((session: SessionData) => ({
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
        isActive: session.is_active,
      }))
    } catch (error) {
      logger.dev.warn('Failed to load chat history:', error)
      return []
    }
  }

  public async deleteChatSession(sessionId?: string): Promise<void> {
    try {
      const targetSessionId = sessionId || this.sessionId
      
      const response = await fetch(`/api/sessions/${targetSessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete chat session')
      }
    } catch (error) {
      logger.dev.warn('Failed to delete chat session:', error)
      throw error
    }
  }

  public async searchChatSessions(searchTerm: string, limit = 10): Promise<Array<{
    id: string
    title: string
    createdAt: string
    messageCount: number
  }>> {
    try {
      if (!this.userId) {
        return []
      }

      const response = await fetch(`/api/sessions?search=${encodeURIComponent(searchTerm)}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to search chat sessions')
      }

      const data = await response.json()
      const sessions = data.sessions || []
      
      return sessions.map((session: SessionData) => ({
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
      }))
    } catch (error) {
      logger.dev.warn('Failed to search chat sessions:', error)
      return []
    }
  }

  public async getUserActivity(): Promise<{
    totalChats: number
    activeChats: number
    totalMessages: number
    favoriteModels: Array<{ model: string; count: number }>
    recentActivity: Array<{
      id: string
      title: string
      createdAt: string
      messageCount: number
    }>
  } | null> {
    try {
      if (!this.userId) {
        return null
      }

      // For now, we'll use the sessions endpoint to calculate activity
      // In the future, this could be a dedicated endpoint for better performance
      const response = await fetch('/api/sessions?limit=100', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to get user activity')
      }

      const data = await response.json()
      const sessions = data.sessions || []

      // Calculate metrics from sessions
      const totalChats = sessions.length
      const activeChats = sessions.filter((s: SessionData) => s.is_active).length
      const totalMessages = sessions.reduce((total: number, session: SessionData) => {
        return total + (Array.isArray(session.messages) ? session.messages.length : 0)
      }, 0)

      // Calculate favorite models
      const modelCounts = new Map<string, number>()
      sessions.forEach((session: SessionData) => {
        const current = modelCounts.get(session.model) || 0
        modelCounts.set(session.model, current + 1)
      })

      const favoriteModels = Array.from(modelCounts.entries())
        .map(([model, count]) => ({ model, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const recentActivity = sessions.slice(0, 10).map((session: SessionData) => ({
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
      }))
      
      return {
        totalChats,
        activeChats,
        totalMessages,
        favoriteModels,
        recentActivity,
      }
    } catch (error) {
      logger.dev.warn('Failed to get user activity:', error)
      return null
    }
  }

  public async getMemoryContext(userId: string, limit = 5): Promise<string> {
    try {
      // Fetch recent chat summaries for memory context
      const response = await fetch(`/api/memory-context?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // No summaries found, return empty context
          return ''
        }
        throw new Error('Failed to fetch memory context')
      }

      const data = await response.json()
      const summaries = data.summaries || []

      if (summaries.length === 0) {
        return ''
      }

      // Build memory context from summaries
      const memoryContext = summaries.map((summary: { summary: string; key_topics: string[]; user_preferences?: { explicit?: Record<string, unknown> } }, index: number) => {
        const { summary: text, key_topics, user_preferences } = summary
        const topics = Array.isArray(key_topics) ? key_topics.join(', ') : 'general conversation'
        
        return `Previous Conversation ${index + 1}:
Summary: ${text}
Topics discussed: ${topics}
User preferences noted: ${user_preferences?.explicit ? Object.keys(user_preferences.explicit).join(', ') : 'none'}`
      }).join('\n\n')

      return `CONVERSATION MEMORY:
The following is context from your previous conversations with this user. Use this to provide more personalized and contextually aware responses:

${memoryContext}

---`
    } catch (error) {
      logger.error('Failed to fetch memory context:', error)
      return ''
    }
  }
}