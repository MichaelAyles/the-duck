import { OpenRouterModel, ChatMessage } from '@/types/chat'
import { DEFAULT_ACTIVE_MODELS } from '@/lib/config'
import { cache, cacheKeys, CACHE_TTL } from '@/lib/redis'
import { logger } from '@/lib/logger'

interface OpenRouterModelResponse {
  id: string;
  name?: string;
  description?: string;
  pricing?: {
    prompt?: number;
    completion?: number;
  };
  context_length?: number;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
}

export class OpenRouterClient {
  private apiKey: string | null
  private baseUrl = 'https://openrouter.ai/api/v1'

  constructor(apiKey?: string) {
    // Clean the API key (remove surrounding quotes if present)
    this.apiKey = apiKey ? apiKey.replace(/^["']|["']$/g, '') : null
  }

  async getModels(): Promise<OpenRouterModel[]> {
    if (!this.apiKey) {
      // Return centralized default active models when no API key is available
      logger.dev.log('OpenRouter API key not configured, returning default active models')
      
      return DEFAULT_ACTIVE_MODELS.map((modelId) => {
        const [provider, ...modelParts] = modelId.split('/')
        const modelName = modelParts.join('/')
        
        return {
          id: modelId,
          name: this.getModelDisplayName(modelId),
          description: `${provider} model: ${modelName}`,
          pricing: { prompt: 0.0001, completion: 0.0002, currency: 'USD' },
          context_length: 16384,
          architecture: {
            modality: 'text',
            tokenizer: 'default',
            instruct_type: 'chat'
          },
          top_provider: {
            max_completion_tokens: 4096,
            is_moderated: true
          }
        }
      })
    }

    try {
      // Check cache first
      const cacheKey = cacheKeys.modelCatalog()
      const cachedModels = await cache.get<OpenRouterModel[]>(cacheKey)
      
      if (cachedModels) {
        logger.dev.log('Returning cached OpenRouter models')
        return cachedModels
      }

      // Fetch from OpenRouter API if not in cache
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data = await response.json()
      const models = data.data.map((model: OpenRouterModelResponse) => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description || '',
        pricing: model.pricing,
        context_length: model.context_length,
        architecture: model.architecture,
        top_provider: model.top_provider,
      }))

      // Cache the models with 1 hour TTL
      await cache.set(cacheKey, models, CACHE_TTL.MODEL_CATALOG)
      logger.dev.log('Cached OpenRouter models')

      return models
    } catch (error) {
      logger.error('Error fetching OpenRouter models:', error)
      throw error
    }
  }

  async *streamChat(
    messages: ChatMessage[],
    model: string,
    options: {
      temperature?: number
      max_tokens?: number
      top_p?: number
      frequency_penalty?: number
      presence_penalty?: number
    } = {}
  ): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required for chat functionality')
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'The Duck',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(msg => {
            // Handle messages with attachments for vision models
            if (msg.attachments && msg.attachments.length > 0) {
              const content = [];
              
              // Add text content if present
              if (msg.content && msg.content.trim()) {
                content.push({
                  type: "text",
                  text: msg.content
                });
              }
              
              // Add image attachments
              const imageAttachments = msg.attachments.filter(attachment => 
                attachment.mime_type?.startsWith('image/') && attachment.url
              );
              
              imageAttachments.forEach(attachment => {
                content.push({
                  type: "image_url",
                  image_url: {
                    url: attachment.url
                  }
                });
              });
              
              if (process.env.NODE_ENV === 'development') {
                logger.dev.log(`🖼️ Sending ${imageAttachments.length} image(s) to OpenRouter for vision processing`);
              }
              
              return {
                role: msg.role,
                content: content
              };
            } else {
              // Standard text-only message
              return {
                role: msg.role,
                content: msg.content,
              };
            }
          }),
          stream: true,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 2048,
          top_p: options.top_p ?? 1,
          frequency_penalty: options.frequency_penalty ?? 0,
          presence_penalty: options.presence_penalty ?? 0,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') return
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices[0]?.delta?.content
              if (content) yield content
            } catch (e) {
              logger.error('Error parsing streaming response:', e)
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error in OpenRouter stream chat:', error)
      throw error
    }
  }

  async chat(
    messages: ChatMessage[],
    model: string,
    options: {
      temperature?: number
      max_tokens?: number
      top_p?: number
      frequency_penalty?: number
      presence_penalty?: number
    } = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required for chat functionality')
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'The Duck',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(msg => {
            // Handle messages with attachments for vision models
            if (msg.attachments && msg.attachments.length > 0) {
              const content = [];
              
              // Add text content if present
              if (msg.content && msg.content.trim()) {
                content.push({
                  type: "text",
                  text: msg.content
                });
              }
              
              // Add image attachments
              const imageAttachments = msg.attachments.filter(attachment => 
                attachment.mime_type?.startsWith('image/') && attachment.url
              );
              
              imageAttachments.forEach(attachment => {
                content.push({
                  type: "image_url",
                  image_url: {
                    url: attachment.url
                  }
                });
              });
              
              if (process.env.NODE_ENV === 'development') {
                logger.dev.log(`🖼️ Sending ${imageAttachments.length} image(s) to OpenRouter for vision processing`);
              }
              
              return {
                role: msg.role,
                content: content
              };
            } else {
              // Standard text-only message
              return {
                role: msg.role,
                content: msg.content,
              };
            }
          }),
          stream: false,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 2048,
          top_p: options.top_p ?? 1,
          frequency_penalty: options.frequency_penalty ?? 0,
          presence_penalty: options.presence_penalty ?? 0,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || ''
    } catch (error) {
      logger.error('Error in OpenRouter chat:', error)
      throw error
    }
  }

  private getModelDisplayName(modelId: string): string {
    const displayNames: Record<string, string> = {
      'google/gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash Preview',
      'google/gemini-2.5-pro-preview-05-06': 'Gemini 2.5 Pro Preview', 
      'deepseek/deepseek-chat-v3-0324': 'DeepSeek Chat v3',
      'anthropic/claude-sonnet-4': 'Claude Sonnet 4',
      'openai/gpt-4o-mini': 'GPT-4o Mini'
    }
    
    return displayNames[modelId] || modelId.split('/')[1] || modelId
  }
}

// Default curated models for the dropdown
export const CURATED_MODELS = [
  {
    id: 'google/gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash Preview',
    provider: 'Google',
    starred: true,
  },
  {
    id: 'google/gemini-2.5-pro-preview-05-06',
    name: 'Gemini 2.5 Pro Preview',
    provider: 'Google',
    starred: true,
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324',
    name: 'DeepSeek Chat v3',
    provider: 'DeepSeek',
    starred: true,
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    starred: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    starred: true,
  },
]