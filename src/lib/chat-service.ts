import { Message } from '@/types/chat'
import { nanoid } from 'nanoid'

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
    try {
      // Don't save if no user is authenticated
      if (!this.userId) {
        console.log('Skipping chat session save - no user authenticated')
        return
      }

      // Use provided title or default to 'New Chat' - title generation now handled by dedicated API
      const sessionTitle = title || 'New Chat'
      
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

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save chat session')
      }
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
      if (!this.userId) {
        console.log('No user ID available for loading session')
        return []
      }

      console.log(`Loading session ${this.sessionId} for user ${this.userId}`)
      
      const response = await fetch(`/api/sessions/${this.sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Session ${this.sessionId} not found`)
          return []
        }
        throw new Error('Failed to load chat session')
      }

      const data = await response.json()
      const session = data.session
      
      if (session && Array.isArray(session.messages)) {
        console.log(`Found ${session.messages.length} messages in session ${this.sessionId}`)
        return session.messages as Message[]
      }
      
      console.log(`No messages found for session ${this.sessionId}`)
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
              activeResponseLength: 0.5
            }
          }
        }
      }
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
      console.warn('Failed to load chat history:', error)
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
      console.warn('Failed to get user activity:', error)
      return null
    }
  }
}