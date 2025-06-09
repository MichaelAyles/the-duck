import { DatabaseService } from './db/operations'
import { Message } from '@/components/chat/chat-interface'
import { nanoid } from 'nanoid'

const INACTIVITY_TIMEOUT = 10 * 60 * 1000 // 10 minutes in milliseconds

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
        preferredResponseLength: number
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

  public async saveChatSession(messages: Message[], model: string) {
    try {
      const title = this.generateTitle(messages)
      
      await DatabaseService.saveChatSession(
        this.sessionId,
        title,
        messages,
        model,
        this.userId
      )
    } catch (error) {
      // Handle errors gracefully
      console.warn('Chat session save failed (storage may be disabled):', error)
      // Don't throw error in development mode when storage is not configured
      if (process.env.NODE_ENV !== 'development') {
        throw error
      }
    }
  }

  public async loadChatSession(): Promise<Message[]> {
    try {
      const session = await DatabaseService.getChatSession(this.sessionId, this.userId)
      
      if (session && Array.isArray(session.messages)) {
        return session.messages as unknown as Message[]
      }
      
      return []
    } catch (error) {
      console.warn('Failed to load chat session:', error)
      return []
    }
  }

  public async summarizeChat(messages: Message[]): Promise<ChatSummary> {
    try {
      // Use a cost-effective model for summarization
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      })

      if (!response.ok) {
        throw new Error('Failed to summarize chat')
      }

      const summary = await response.json()

      // Save the summary to the database
      await DatabaseService.saveChatSummary(
        nanoid(),
        this.sessionId,
        summary.summary,
        summary.keyTopics,
        summary.userPreferences,
        summary.userPreferences?.implicit?.writingStyle || {}
      )

      return summary
    } catch (error) {
      console.warn('Chat summarization failed (storage may be disabled):', error)
      
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
              preferredResponseLength: 0.5
            }
          }
        }
      }
    }
  }

  public async endChatSession(): Promise<void> {
    try {
      await DatabaseService.endChatSession(this.sessionId, this.userId)
      this.clearInactivityTimer()
    } catch (error) {
      console.warn('Failed to end chat session:', error)
    }
  }

  public async summarizeAndEndChat(messages: Message[]): Promise<ChatSummary> {
    try {
      const summary = await this.summarizeChat(messages)
      await this.endChatSession()
      return summary
    } catch (error) {
      console.error('Failed to summarize and end chat:', error)
      await this.endChatSession() // Still try to end the session
      throw error
    }
  }

  private generateTitle(messages: Message[]): string {
    if (messages.length === 0) {
      return 'New Chat'
    }

    const firstUserMessage = messages.find(msg => msg.role === 'user')
    if (!firstUserMessage) {
      return 'New Chat'
    }

    // Extract a meaningful title from the first user message
    const content = firstUserMessage.content.trim()
    if (content.length <= 50) {
      return content
    }

    // Truncate and add ellipsis
    return content.substring(0, 47) + '...'
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

      const sessions = await DatabaseService.getAllChatSessions(this.userId, limit)
      
      return sessions.map(session => ({
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
        isActive: session.is_active,
      }))
    } catch (error) {
      console.warn('Failed to load chat history:', error)
      return []
    }
  }

  public async deleteChatSession(sessionId?: string): Promise<void> {
    try {
      const targetSessionId = sessionId || this.sessionId
      await DatabaseService.deleteChatSession(targetSessionId, this.userId)
    } catch (error) {
      console.warn('Failed to delete chat session:', error)
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

      const sessions = await DatabaseService.searchChatSessions(searchTerm, this.userId, limit)
      
      return sessions.map(session => ({
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
      }))
    } catch (error) {
      console.warn('Failed to search chat sessions:', error)
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

      const activity = await DatabaseService.getUserActivity(this.userId)
      
      return {
        totalChats: activity.totalChats,
        activeChats: activity.activeChats,
        totalMessages: activity.totalMessages,
        favoriteModels: activity.favoriteModels,
        recentActivity: activity.recentActivity.map(session => ({
          id: session.id,
          title: session.title,
          createdAt: session.created_at,
          messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
        })),
      }
    } catch (error) {
      console.warn('Failed to get user activity:', error)
      return null
    }
  }
} 