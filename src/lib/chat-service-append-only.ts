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

/**
 * Append-Only ChatService - Prevents data loss from concurrent saves
 * 
 * This implementation stores messages individually in the database
 * instead of replacing entire message arrays, eliminating race conditions
 * that can cause data loss during concurrent operations.
 */
export class AppendOnlyChatService {
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

  /**
   * Creates a new chat session with empty message list
   * Thread-safe operation that creates session metadata only
   */
  public async createChatSession(model: string, title?: string) {
    if (!this.userId) {
      if (process.env.NODE_ENV === 'development') {
        logger.dev.log('Skipping chat session creation - no user authenticated')
      }
      return
    }

    const sessionTitle = title || 'New Chat'
    
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: this.sessionId,
          title: sessionTitle,
          messages: [], // Empty array for compatibility
          model,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP ${response.status}: Failed to create chat session`)
      }

      if (process.env.NODE_ENV === 'development') {
        logger.dev.log(`✅ Session ${this.sessionId} created successfully`)
      }

    } catch (error) {
      logger.error(`❌ Failed to create session ${this.sessionId}:`, error)
      throw error
    }
  }

  /**
   * Appends a single message to the session
   * Thread-safe operation that never overwrites existing messages
   */
  public async appendMessage(role: 'user' | 'assistant' | 'system', content: string, metadata: Record<string, unknown> = {}) {
    if (!this.userId) {
      throw new Error('User must be authenticated to append messages')
    }

    try {
      const response = await fetch('/api/messages/append', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          role,
          content,
          metadata,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP ${response.status}: Failed to append message`)
      }

      const result = await response.json()
      
      if (process.env.NODE_ENV === 'development') {
        logger.dev.log(`✅ Message appended to session ${this.sessionId}:`, {
          role,
          contentLength: content.length,
          messageId: result.message.id
        })
      }

      return result.message

    } catch (error) {
      logger.error(`❌ Failed to append message to session ${this.sessionId}:`, error)
      throw error
    }
  }

  /**
   * Loads all messages for the session
   * Efficient read operation from individual message records
   */
  public async loadChatSession(): Promise<Message[]> {
    try {
      if (!this.userId) {
        logger.dev.log('No user ID available for loading session')
        return []
      }

      if (process.env.NODE_ENV === 'development') {
        logger.dev.log(`Loading session ${this.sessionId} for user ${this.userId}`)
      }
      
      const response = await fetch(`/api/sessions/${this.sessionId}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 404) {
        if (process.env.NODE_ENV === 'development') {
          logger.dev.log(`Session ${this.sessionId} not found`)
        }
        return []
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load chat session`)
      }

      const data = await response.json()
      const messages = data.messages || []
      
      if (process.env.NODE_ENV === 'development') {
        logger.dev.log(`✅ Session ${this.sessionId} loaded successfully with ${messages.length} messages`)
      }

      // Convert to expected Message format
      return messages.map((msg: Record<string, unknown>) => ({
        role: msg.role as string,
        content: msg.content as string,
        ...(typeof msg.metadata === 'object' && msg.metadata !== null ? msg.metadata as Record<string, unknown> : {})
      }))
      
    } catch (error) {
      console.warn('Failed to load chat session:', error)
      return []
    }
  }

  /**
   * Batch append multiple messages
   * Useful for migrating existing conversations or bulk operations
   */
  public async appendMessages(messages: Array<{ role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, unknown> }>) {
    const results = []
    
    for (const message of messages) {
      try {
        const result = await this.appendMessage(message.role, message.content, message.metadata || {})
        results.push(result)
      } catch (error) {
        logger.error(`Failed to append message in batch:`, error)
        throw error // Stop on first failure to maintain consistency
      }
    }
    
    return results
  }

  /**
   * Get session metadata and message count
   * Efficient way to get session info without loading all messages
   */
  public async getSessionInfo(): Promise<{ session: SessionData, messageCount: number } | null> {
    try {
      const response = await fetch(`/api/sessions/${this.sessionId}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to get session info`)
      }

      const data = await response.json()
      
      return {
        session: data.session,
        messageCount: data.messageCount || 0
      }
      
    } catch (error) {
      console.warn('Failed to get session info:', error)
      return null
    }
  }

  /**
   * Get current session title for preservation during operations
   */
  public async getCurrentSessionTitle(): Promise<string | null> {
    try {
      if (!this.userId) return null
      
      const info = await this.getSessionInfo()
      return info?.session.title || null
      
    } catch (error) {
      console.warn('Failed to get session title:', error)
      return null
    }
  }

  /**
   * Legacy compatibility method for existing code
   * Migrates from array-based saves to append-only
   */
  public async saveChatSession(messages: Message[], model: string, title?: string) {
    if (!this.userId) {
      if (process.env.NODE_ENV === 'development') {
        logger.dev.log('Skipping chat session save - no user authenticated')
      }
      return
    }

    try {
      // Check if session exists
      const existingInfo = await this.getSessionInfo()
      
      if (!existingInfo) {
        // Create new session
        await this.createChatSession(model, title)
      }

      // Get existing messages to avoid duplicates
      const existingMessages = await this.loadChatSession()
      
      // Find new messages that need to be appended
      const newMessages = messages.slice(existingMessages.length)
      
      if (newMessages.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          logger.dev.log(`Appending ${newMessages.length} new messages to session ${this.sessionId}`)
        }
        
        // Append only the new messages
        for (const message of newMessages) {
          await this.appendMessage(
            message.role as 'user' | 'assistant' | 'system',
            message.content,
            { ...message } // Include any additional properties as metadata
          )
        }
      }

    } catch (error) {
      logger.error(`❌ Failed to save chat session ${this.sessionId}:`, error)
      throw error
    }
  }

  public async summarizeChat(messages: Message[]): Promise<ChatSummary> {
    try {
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
      return summary
      
    } catch (error) {
      console.warn('Chat summarization failed (storage may be disabled):', error)
      
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
}