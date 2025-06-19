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
        
        // Realistic pricing estimates based on typical model costs
        const pricing = this.getEstimatedPricing(modelId)
        
        return {
          id: modelId,
          name: this.getModelDisplayName(modelId),
          description: `${provider} model: ${modelName}`,
          pricing,
          context_length: this.getEstimatedContextLength(modelId),
          architecture: {
            modality: 'text',
            tokenizer: 'default',
            instruct_type: 'chat'
          },
          top_provider: {
            max_completion_tokens: 4096,
            is_moderated: true
          },
          latency: this.estimateLatency(modelId)
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
        latency: this.estimateLatency(model.id), // Add estimated latency
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
          max_tokens: options.max_tokens ?? 4096,
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
          max_tokens: options.max_tokens ?? 4096,
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

  private getEstimatedPricing(modelId: string): { prompt: number; completion: number; currency: string } {
    // Realistic pricing estimates based on actual model costs (per 1M tokens)
    const modelLower = modelId.toLowerCase()
    
    if (modelLower.includes('gpt-4o-mini')) {
      return { prompt: 0.15, completion: 0.60, currency: 'USD' }
    } else if (modelLower.includes('gpt-4o')) {
      return { prompt: 5.00, completion: 15.00, currency: 'USD' }
    } else if (modelLower.includes('claude-3-5-sonnet')) {
      return { prompt: 3.00, completion: 15.00, currency: 'USD' }
    } else if (modelLower.includes('claude-sonnet-4')) {
      return { prompt: 4.00, completion: 20.00, currency: 'USD' }
    } else if (modelLower.includes('gemini-2.5-flash')) {
      return { prompt: 0.075, completion: 0.30, currency: 'USD' }
    } else if (modelLower.includes('gemini-2.5-pro')) {
      return { prompt: 1.25, completion: 5.00, currency: 'USD' }
    } else if (modelLower.includes('deepseek')) {
      return { prompt: 0.55, completion: 2.19, currency: 'USD' }
    } else {
      // Default for unknown models
      return { prompt: 2.00, completion: 8.00, currency: 'USD' }
    }
  }

  private getEstimatedContextLength(modelId: string): number {
    const modelLower = modelId.toLowerCase()
    
    if (modelLower.includes('claude')) {
      return 200000 // Claude models typically have 200k context
    } else if (modelLower.includes('gemini-2.5')) {
      return 2000000 // Gemini 2.5 has 2M context
    } else if (modelLower.includes('gpt-4o')) {
      return 128000 // GPT-4o has 128k context
    } else if (modelLower.includes('deepseek')) {
      return 64000 // DeepSeek typically 64k
    } else {
      return 32000 // Default context length
    }
  }

  private estimateLatency(modelId: string): { p50: number; p95: number } {
    // Estimate latency based on provider and model characteristics
    // These are approximations based on typical performance patterns
    const provider = modelId.split('/')[0];
    
    const providerLatencyBase = {
      'openai': { p50: 800, p95: 1500 },
      'anthropic': { p50: 1200, p95: 2200 },
      'google': { p50: 1000, p95: 1800 },
      'meta-llama': { p50: 1400, p95: 2500 },
      'mistralai': { p50: 900, p95: 1600 },
      'deepseek': { p50: 1100, p95: 2000 },
      'qwen': { p50: 1300, p95: 2300 },
      'cohere': { p50: 1000, p95: 1900 },
      'perplexity': { p50: 1200, p95: 2100 },
      'x-ai': { p50: 1500, p95: 2800 },
    };
    
    const baseLatency = providerLatencyBase[provider as keyof typeof providerLatencyBase] || { p50: 1200, p95: 2200 };
    
    // Adjust based on model size/complexity (inferred from model name)
    let multiplier = 1.0;
    const modelLower = modelId.toLowerCase();
    
    if (modelLower.includes('mini') || modelLower.includes('small')) {
      multiplier = 0.7; // Smaller models are faster
    } else if (modelLower.includes('large') || modelLower.includes('xl')) {
      multiplier = 1.4; // Larger models are slower
    } else if (modelLower.includes('turbo') || modelLower.includes('flash')) {
      multiplier = 0.8; // Optimized models are faster
    } else if (modelLower.includes('preview') || modelLower.includes('experimental')) {
      multiplier = 1.3; // Experimental models may be slower
    }
    
    return {
      p50: Math.round(baseLatency.p50 * multiplier),
      p95: Math.round(baseLatency.p95 * multiplier),
    };
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