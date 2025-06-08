export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export interface OpenRouterModel {
  id: string
  name: string
  description: string
  pricing?: {
    prompt: string
    completion: string
  }
  context_length?: number
  architecture?: {
    modality: string
    tokenizer: string
    instruct_type?: string
  }
  top_provider?: {
    max_completion_tokens?: number
    is_moderated: boolean
  }
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface UserPreferences {
  starredModels: string[]
  theme: 'light' | 'dark' | 'system'
  responseTone: 'match' | 'professional' | 'casual' | 'concise' | 'detailed'
  storageEnabled: boolean
  explicitPreferences: Record<string, any>
  writingStyle?: {
    verbosity: 'short' | 'medium' | 'long'
    formality: 'casual' | 'neutral' | 'formal'
    technicalLevel: 'basic' | 'intermediate' | 'advanced'
    preferredTopics: string[]
    dislikedTopics: string[]
  }
}

export interface ChatSummary {
  id: string
  sessionId: string
  summary: string
  keyTopics: string[]
  userPreferences: Record<string, any>
  writingStyleAnalysis: UserPreferences['writingStyle']
  createdAt: Date
}