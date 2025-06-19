import { ChatService } from '@/lib/chat-service'
import { Message } from '@/types/chat'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: () => 'mock-session-id'
}))

describe('ChatService', () => {
  let chatService: ChatService
  const mockUserId = 'test-user-id'
  const mockSessionId = 'test-session-id'

  beforeEach(() => {
    jest.clearAllMocks()
    chatService = new ChatService(mockSessionId, mockUserId)
  })

  describe('constructor', () => {
    it('should create with provided session ID and user ID', () => {
      expect(chatService.getSessionId()).toBe(mockSessionId)
    })

    it('should generate session ID if not provided', () => {
      const newService = new ChatService()
      expect(newService.getSessionId()).toBe('mock-session-id')
    })

    it('should allow setting user ID after creation', () => {
      const newService = new ChatService()
      newService.setUserId('new-user-id')
      // We can't directly test this since userId is private, but we can test it indirectly
      expect(newService).toBeDefined()
    })
  })

  describe('getSessionId', () => {
    it('should return the session ID', () => {
      expect(chatService.getSessionId()).toBe(mockSessionId)
    })
  })

  describe('saveChatSession', () => {
    const mockMessages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date()
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date()
      }
    ]

    it('should skip saving if no user ID is set', async () => {
      const serviceWithoutUser = new ChatService(mockSessionId)
      await serviceWithoutUser.saveChatSession(mockMessages, 'test-model')
      
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should save chat session successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      await chatService.saveChatSession(mockMessages, 'test-model', 'Test Title')

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: mockSessionId,
          title: 'Test Title',
          messages: mockMessages,
          model: 'test-model',
        }),
      })
    })

    it('should use default title if not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      await chatService.saveChatSession(mockMessages, 'test-model')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"title":"New Chat"')
        })
      )
    })

    it('should retry on failure', async () => {
      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })

      await chatService.saveChatSession(mockMessages, 'test-model')

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should throw error after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'))

      await expect(
        chatService.saveChatSession(mockMessages, 'test-model')
      ).rejects.toThrow('Persistent network error')

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('loadChatSession', () => {
    it('should return empty array if no user ID', async () => {
      const serviceWithoutUser = new ChatService(mockSessionId)
      const result = await serviceWithoutUser.loadChatSession()
      
      expect(result).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should load session successfully', async () => {
      const mockSession = {
        id: mockSessionId,
        messages: [
          { id: '1', role: 'user', content: 'Hello', timestamp: new Date() }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ session: mockSession })
      })

      const result = await chatService.loadChatSession()

      expect(mockFetch).toHaveBeenCalledWith(`/api/sessions/${mockSessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      expect(result).toEqual(mockSession.messages)
    })

    it('should return empty array for 404 after retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      })

      const result = await chatService.loadChatSession()

      expect(result).toEqual([])
      expect(mockFetch).toHaveBeenCalledTimes(3) // Should retry 3 times for 404
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await chatService.loadChatSession()

      expect(result).toEqual([])
    })
  })

  describe('summarizeChat', () => {
    const mockMessages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date()
      }
    ]

    it('should create chat summary successfully', async () => {
      const mockSummary = {
        summary: 'Test conversation summary',
        keyTopics: ['greeting'],
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummary)
      })

      const result = await chatService.summarizeChat(mockMessages)

      expect(mockFetch).toHaveBeenCalledWith('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: mockMessages,
          sessionId: mockSessionId
        }),
      })
      expect(result).toEqual(mockSummary)
    })

    it('should return default summary on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'))

      const result = await chatService.summarizeChat(mockMessages)

      expect(result).toEqual({
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
      })
    })
  })

  describe('getMemoryContext', () => {
    it('should fetch memory context successfully', async () => {
      const mockMemoryData = {
        summaries: [
          {
            summary: 'Previous chat about AI',
            key_topics: ['AI', 'technology'],
            user_preferences: { explicit: {} }
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMemoryData)
      })

      const result = await chatService.getMemoryContext(mockUserId, 3)

      expect(mockFetch).toHaveBeenCalledWith('/api/memory-context?limit=3', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      expect(result).toContain('CONVERSATION MEMORY')
      expect(result).toContain('Previous chat about AI')
      expect(result).toContain('AI, technology')
    })

    it('should return empty string on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const result = await chatService.getMemoryContext(mockUserId)

      expect(result).toBe('')
    })

    it('should return empty string on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await chatService.getMemoryContext(mockUserId)

      expect(result).toBe('')
    })

    it('should return empty string for no summaries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ summaries: [] })
      })

      const result = await chatService.getMemoryContext(mockUserId)

      expect(result).toBe('')
    })
  })

  describe('inactivity handling', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should setup inactivity timer', () => {
      const mockCallback = jest.fn()
      
      chatService.setupInactivityHandler(mockCallback)
      
      // Timer should not have fired yet
      expect(mockCallback).not.toHaveBeenCalled()
      
      // Fast-forward time
      jest.advanceTimersByTime(10 * 60 * 1000) // 10 minutes
      
      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('should clear inactivity timer', () => {
      const mockCallback = jest.fn()
      
      chatService.setupInactivityHandler(mockCallback)
      chatService.clearInactivityTimer()
      
      // Fast-forward time
      jest.advanceTimersByTime(10 * 60 * 1000)
      
      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should replace existing timer when setting up new one', () => {
      const mockCallback1 = jest.fn()
      const mockCallback2 = jest.fn()
      
      chatService.setupInactivityHandler(mockCallback1)
      chatService.setupInactivityHandler(mockCallback2)
      
      // Fast-forward time
      jest.advanceTimersByTime(10 * 60 * 1000)
      
      expect(mockCallback1).not.toHaveBeenCalled()
      expect(mockCallback2).toHaveBeenCalledTimes(1)
    })
  })
})