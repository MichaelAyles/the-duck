import { OpenRouterModel, ChatMessage } from '@/types/chat'

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
    this.apiKey = apiKey || null
  }

  async getModels(): Promise<OpenRouterModel[]> {
    if (!this.apiKey) {
      // Return default models when no API key is available
      return [
        {
          id: 'openai/gpt-4o-mini',
          name: 'GPT-4o Mini',
          description: 'A smaller version of GPT-4o',
          pricing: { prompt: 0.0001, completion: 0.0002, currency: 'USD' },
          context_length: 8192,
          architecture: {
            modality: 'text',
            tokenizer: 'cl100k_base',
            instruct_type: 'chat'
          },
          top_provider: {
            max_completion_tokens: 4096,
            is_moderated: true
          }
        },
        {
          id: 'anthropic/claude-3.5-sonnet',
          name: 'Claude 3.5 Sonnet',
          description: 'Anthropic\'s Claude 3.5 Sonnet model',
          pricing: { prompt: 0.00015, completion: 0.00025, currency: 'USD' },
          context_length: 16384,
          architecture: {
            modality: 'text',
            tokenizer: 'claude',
            instruct_type: 'chat'
          },
          top_provider: {
            max_completion_tokens: 8192,
            is_moderated: true
          }
        }
      ]
    }

    try {
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
      return data.data.map((model: OpenRouterModelResponse) => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description || '',
        pricing: model.pricing,
        context_length: model.context_length,
        architecture: model.architecture,
        top_provider: model.top_provider,
      }))
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error)
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
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
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
              console.error('Error parsing streaming response:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in OpenRouter stream chat:', error)
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
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
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
      console.error('Error in OpenRouter chat:', error)
      throw error
    }
  }
}

// Default curated models for the dropdown
export const CURATED_MODELS = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    starred: true,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    starred: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    starred: true,
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    provider: 'Google',
    starred: true,
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B (Free)',
    provider: 'Meta',
    starred: true,
  },
]