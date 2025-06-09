import { supabase } from './supabase'
import { Message } from '@/components/chat/chat-interface'
import { nanoid } from 'nanoid'

const INACTIVITY_TIMEOUT = 10 * 60 * 1000 // 10 minutes in milliseconds

export interface ChatSummary {
  summary: string
  keyTopics: string[]
  userPreferences: {
    explicit: Record<string, any>
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
  private inactivityTimer: NodeJS.Timeout | null = null
  private lastActivityTime: number = Date.now()

  constructor(
    private sessionId: string,
    private onInactivity: () => void
  ) {
    this.resetInactivityTimer()
  }

  private resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer)
    }
    this.lastActivityTime = Date.now()
    this.inactivityTimer = setTimeout(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivityTime
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        this.onInactivity()
      }
    }, INACTIVITY_TIMEOUT)
  }

  public updateActivity() {
    this.resetInactivityTimer()
  }

  public async saveChatSession(messages: Message[], model: string) {
    const title = this.generateTitle(messages)
    
    const { error } = await supabase
      .from('chat_sessions')
      .upsert({
        id: this.sessionId,
        title,
        messages,
        model,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true
      })

    if (error) {
      console.error('Error saving chat session:', error)
      throw error
    }
  }

  public async summarizeChat(messages: Message[]): Promise<ChatSummary> {
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
    const { error } = await supabase
      .from('chat_summaries')
      .insert({
        id: nanoid(),
        session_id: this.sessionId,
        summary: summary.summary,
        key_topics: summary.keyTopics,
        user_preferences: summary.userPreferences,
        writing_style_analysis: summary.userPreferences.implicit.writingStyle,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Error saving chat summary:', error)
      throw error
    }

    return summary
  }

  private generateTitle(messages: Message[]): string {
    // Use the first user message as the title, truncated to 50 characters
    const firstUserMessage = messages.find(m => m.role === 'user')
    if (firstUserMessage) {
      return firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
    }
    return 'New Chat'
  }

  public cleanup() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer)
    }
  }
} 