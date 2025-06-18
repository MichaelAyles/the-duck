import { useState, useCallback, useRef } from 'react'
import { ChatMessage } from '@/types/chat'
import { nanoid } from 'nanoid'

interface UseChatOptions {
  model: string
  onError?: (error: Error) => void
  onFinish?: (message: ChatMessage) => void
}

export function useChat({ model, onError, onFinish }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nanoid(),
      role: 'assistant',
      content: "Hello! I'm The Duck, your friendly AI assistant. I'm here to help with anything you need! Whether you have questions, need creative assistance, or just want to chat, I'm your personal duck that quacks back. What can I assist you with today?",
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    const assistantMessage: ChatMessage = {
      id: nanoid(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setIsLoading(true)

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          model,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                setIsLoading(false)
                setMessages(prev => {
                  const updated = [...prev]
                  const lastMessage = updated[updated.length - 1]
                  if (lastMessage && onFinish) {
                    onFinish(lastMessage)
                  }
                  return updated
                })
                return
              }

              try {
                const parsed = JSON.parse(data)
                if (parsed.error) {
                  throw new Error(parsed.error)
                }
                
                if (parsed.content) {
                  setMessages(prev => {
                    const updated = [...prev]
                    const lastMessage = updated[updated.length - 1]
                    if (lastMessage && lastMessage.role === 'assistant') {
                      lastMessage.content += parsed.content
                    }
                    return updated
                  })
                }
              } catch {
                // Skip invalid JSON lines
                continue
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      setIsLoading(false)
      
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't show error
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      
      // Remove the empty assistant message and show error
      setMessages(prev => {
        const updated = prev.slice(0, -1)
        return [
          ...updated,
          {
            id: nanoid(),
            role: 'assistant',
            content: `I apologize, but I encountered an error: ${errorMessage}. Please try again.`,
            timestamp: new Date(),
          },
        ]
      })

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage))
      }
    }
  }, [messages, model, isLoading, onError, onFinish])

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: nanoid(),
        role: 'assistant',
        content: "Hello! I'm The Duck, your friendly AI assistant. I'm here to help with anything you need! Whether you have questions, need creative assistance, or just want to chat, I'm your personal duck that quacks back. What can I assist you with today?",
        timestamp: new Date(),
      },
    ])
  }, [])

  return {
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
    clearMessages,
  }
}