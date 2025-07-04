export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    model?: string
    tokens?: number
    processingTime?: number
    isThinking?: boolean
  }
  attachments?: {
    id: string
    file_name: string
    file_type: string
    file_size: number
    mime_type: string
    url?: string
  }[]
  artifacts?: {
    id: string
    type: 'react-component' | 'html' | 'javascript' | 'css' | 'json'
    title: string
    description?: string
    fileId?: string
  }[]
}

// Alias for backwards compatibility
export type Message = ChatMessage

export interface OpenRouterModel {
  id: string
  name: string
  description: string
  pricing: {
    prompt: number
    completion: number
    currency?: string
  }
  context_length: number
  architecture: {
    modality: string
    tokenizer: string
    instruct_type?: string
  }
  top_provider: {
    max_completion_tokens?: number
    is_moderated: boolean
  }
  latency?: {
    p50?: number
    p95?: number
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
  explicitPreferences: Record<string, unknown>
  writingStyle?: {
    verbosity: 'short' | 'medium' | 'long'
    formality: 'casual' | 'neutral' | 'formal'
    technicalLevel: 'basic' | 'intermediate' | 'advanced'
    activeTopics: string[]
    avoidedTopics: string[]
  }
}

export interface ChatSummary {
  id: string
  sessionId: string
  summary: string
  keyTopics: string[]
  userPreferences: Record<string, unknown>
  writingStyleAnalysis: UserPreferences['writingStyle']
  createdAt: Date
}