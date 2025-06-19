import { InputValidation, SECURITY_CONFIG } from '@/lib/security'

describe('Security', () => {
  describe('SECURITY_CONFIG', () => {
    it('should have rate limit configuration', () => {
      expect(SECURITY_CONFIG).toHaveProperty('RATE_LIMIT')
      expect(SECURITY_CONFIG.RATE_LIMIT).toHaveProperty('WINDOW_MS')
      expect(SECURITY_CONFIG.RATE_LIMIT).toHaveProperty('MAX_REQUESTS')
    })

    it('should have input limit configuration', () => {
      expect(SECURITY_CONFIG).toHaveProperty('INPUT_LIMITS')
      expect(SECURITY_CONFIG.INPUT_LIMITS).toHaveProperty('MESSAGE_LENGTH')
      expect(SECURITY_CONFIG.INPUT_LIMITS).toHaveProperty('MESSAGES_COUNT')
      expect(SECURITY_CONFIG.INPUT_LIMITS).toHaveProperty('SESSION_ID_LENGTH')
    })

    it('should have reasonable rate limits', () => {
      expect(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.CHAT).toBeGreaterThan(0)
      expect(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.MODELS).toBeGreaterThan(0)
      expect(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.API).toBeGreaterThan(0)
    })

    it('should have reasonable input limits', () => {
      expect(SECURITY_CONFIG.INPUT_LIMITS.MESSAGE_LENGTH).toBeGreaterThan(100)
      expect(SECURITY_CONFIG.INPUT_LIMITS.MESSAGES_COUNT).toBeGreaterThan(10)
      expect(SECURITY_CONFIG.INPUT_LIMITS.SESSION_ID_LENGTH).toBeGreaterThan(8)
    })
  })

  describe('InputValidation', () => {
    describe('sanitizeInput', () => {
      it('should remove script tags', () => {
        const maliciousInput = '<script>alert("xss")</script>Hello World'
        const sanitized = InputValidation.sanitizeInput(maliciousInput)
        expect(sanitized).toBe('Hello World')
        expect(sanitized).not.toContain('<script>')
      })

      it('should remove javascript: protocols', () => {
        const maliciousInput = 'javascript:alert("xss") Hello World'
        const sanitized = InputValidation.sanitizeInput(maliciousInput)
        expect(sanitized).toBe('alert("xss") Hello World')
        expect(sanitized).not.toContain('javascript:')
      })

      it('should remove event handlers', () => {
        const maliciousInput = '<div onclick="alert(\'xss\')">Hello World</div>'
        const sanitized = InputValidation.sanitizeInput(maliciousInput)
        expect(sanitized).not.toContain('onclick=')
        expect(sanitized).toContain('Hello World')
      })

      it('should trim whitespace', () => {
        const input = '  Hello World  '
        const sanitized = InputValidation.sanitizeInput(input)
        expect(sanitized).toBe('Hello World')
      })

      it('should handle empty strings', () => {
        expect(InputValidation.sanitizeInput('')).toBe('')
        expect(InputValidation.sanitizeInput('   ')).toBe('')
      })

      it('should preserve safe content', () => {
        const safeInput = 'Hello World! This is a safe message with numbers 123.'
        const sanitized = InputValidation.sanitizeInput(safeInput)
        expect(sanitized).toBe(safeInput)
      })

      it('should handle complex nested malicious content', () => {
        const maliciousInput = '<script><script>alert("nested")</script></script>Safe content'
        const sanitized = InputValidation.sanitizeInput(maliciousInput)
        expect(sanitized).toBe('</script>Safe content')
        expect(sanitized).not.toContain('<script>')
      })
    })

    describe('validateSessionId', () => {
      it('should accept valid session IDs', () => {
        const validIds = [
          'abc123def456',
          'session-123_abc',
          'SESSION_ID_2024',
          '12345678-abcd-efgh'
        ]

        validIds.forEach(id => {
          expect(InputValidation.validateSessionId(id)).toBe(id)
        })
      })

      it('should reject invalid session IDs', () => {
        const invalidIds = [
          '', // empty
          'abc', // too short
          'a'.repeat(100), // too long
          'session with spaces',
          'session@invalid',
          'session#invalid',
          'session!invalid'
        ]

        invalidIds.forEach(id => {
          expect(InputValidation.validateSessionId(id)).toBeNull()
        })
      })

      it('should handle null and undefined', () => {
        expect(InputValidation.validateSessionId('')).toBeNull()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(InputValidation.validateSessionId(null as any)).toBeNull()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(InputValidation.validateSessionId(undefined as any)).toBeNull()
      })

      it('should validate length constraints', () => {
        // Minimum length (8 characters)
        expect(InputValidation.validateSessionId('1234567')).toBeNull() // 7 chars - too short
        expect(InputValidation.validateSessionId('12345678')).toBe('12345678') // 8 chars - valid

        // Maximum length (50 characters)
        const fiftyChars = '12345678901234567890123456789012345678901234567890'
        const fiftyOneChars = fiftyChars + '1'
        
        expect(InputValidation.validateSessionId(fiftyChars)).toBe(fiftyChars) // 50 chars - valid
        expect(InputValidation.validateSessionId(fiftyOneChars)).toBeNull() // 51 chars - too long
      })
    })

    describe('chatRequestSchema', () => {
      const createValidChatRequest = () => ({
        messages: [
          { role: 'user', content: 'Hello World' }
        ],
        model: 'test-model',
        stream: true,
        tone: 'casual',
        memoryEnabled: true,
        memorySummaryCount: 3
      })

      it('should validate valid chat requests', () => {
        const validRequest = createValidChatRequest()
        const result = InputValidation.chatRequestSchema.safeParse(validRequest)
        expect(result.success).toBe(true)
      })

      it('should require messages array', () => {
        const invalidRequest = { ...createValidChatRequest() }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { messages: _, ...requestWithoutMessages } = invalidRequest
        
        const result = InputValidation.chatRequestSchema.safeParse(requestWithoutMessages)
        expect(result.success).toBe(false)
      })

      it('should require model field', () => {
        const invalidRequest = { ...createValidChatRequest() }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { model: _, ...requestWithoutModel } = invalidRequest
        
        const result = InputValidation.chatRequestSchema.safeParse(requestWithoutModel)
        expect(result.success).toBe(false)
      })

      it('should validate message structure', () => {
        const invalidRequest = {
          ...createValidChatRequest(),
          messages: [{ role: 'invalid', content: 'test' }]
        }
        
        const result = InputValidation.chatRequestSchema.safeParse(invalidRequest)
        expect(result.success).toBe(false)
      })

      it('should validate memory settings', () => {
        const requestWithInvalidMemoryCount = {
          ...createValidChatRequest(),
          memorySummaryCount: 15 // exceeds max of 10
        }
        
        const result = InputValidation.chatRequestSchema.safeParse(requestWithInvalidMemoryCount)
        expect(result.success).toBe(false)
      })

      it('should apply default values', () => {
        const minimalRequest = {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'test-model'
        }
        
        const result = InputValidation.chatRequestSchema.safeParse(minimalRequest)
        expect(result.success).toBe(true)
        
        if (result.success) {
          expect(result.data.stream).toBe(true) // default
          expect(result.data.tone).toBe('match-user') // default
          expect(result.data.memoryEnabled).toBe(true) // default
          expect(result.data.memorySummaryCount).toBe(3) // default
        }
      })

      it('should validate attachments structure', () => {
        const requestWithAttachments = {
          ...createValidChatRequest(),
          messages: [{
            role: 'user',
            content: 'Hello with attachment',
            attachments: [{
              id: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
              file_name: 'test.jpg',
              file_type: 'image/jpeg',
              file_size: 1024,
              mime_type: 'image/jpeg',
              url: 'https://example.com/file.jpg'
            }]
          }]
        }
        
        const result = InputValidation.chatRequestSchema.safeParse(requestWithAttachments)
        expect(result.success).toBe(true)
      })
    })
  })
})