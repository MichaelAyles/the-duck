import {
  DEFAULT_AI_MODEL,
  DEFAULT_ACTIVE_MODELS,
  DEFAULT_CHAT_SETTINGS,
  PERFORMANCE_THRESHOLDS,
  FILE_UPLOAD,
  API_ENDPOINTS,
  CHAT_CONFIG,
  RESPONSE_TONES
} from '@/lib/config'

describe('Config', () => {
  describe('DEFAULT_AI_MODEL', () => {
    it('should be defined and not empty', () => {
      expect(DEFAULT_AI_MODEL).toBeDefined()
      expect(typeof DEFAULT_AI_MODEL).toBe('string')
      expect(DEFAULT_AI_MODEL.length).toBeGreaterThan(0)
    })

    it('should be a valid model identifier format', () => {
      expect(DEFAULT_AI_MODEL).toMatch(/^[a-zA-Z0-9\-_\/.]+$/)
    })
  })

  describe('DEFAULT_ACTIVE_MODELS', () => {
    it('should be an array with at least one model', () => {
      expect(Array.isArray(DEFAULT_ACTIVE_MODELS)).toBe(true)
      expect(DEFAULT_ACTIVE_MODELS.length).toBeGreaterThan(0)
    })

    it('should contain the default model', () => {
      expect(DEFAULT_ACTIVE_MODELS).toContain(DEFAULT_AI_MODEL)
    })

    it('should have valid model identifiers', () => {
      DEFAULT_ACTIVE_MODELS.forEach(model => {
        expect(typeof model).toBe('string')
        expect(model.length).toBeGreaterThan(0)
        expect(model).toMatch(/^[a-zA-Z0-9\-_\/.]+$/)
      })
    })
  })

  describe('DEFAULT_CHAT_SETTINGS', () => {
    it('should have required properties', () => {
      expect(DEFAULT_CHAT_SETTINGS).toHaveProperty('tone')
      expect(DEFAULT_CHAT_SETTINGS).toHaveProperty('storageEnabled')
      expect(DEFAULT_CHAT_SETTINGS).toHaveProperty('model')
      expect(DEFAULT_CHAT_SETTINGS).toHaveProperty('memoryEnabled')
      expect(DEFAULT_CHAT_SETTINGS).toHaveProperty('memorySummaryCount')
    })

    it('should have valid property types', () => {
      expect(typeof DEFAULT_CHAT_SETTINGS.tone).toBe('string')
      expect(typeof DEFAULT_CHAT_SETTINGS.storageEnabled).toBe('boolean')
      expect(typeof DEFAULT_CHAT_SETTINGS.model).toBe('string')
      expect(typeof DEFAULT_CHAT_SETTINGS.memoryEnabled).toBe('boolean')
      expect(typeof DEFAULT_CHAT_SETTINGS.memorySummaryCount).toBe('number')
    })

    it('should have the default model', () => {
      expect(DEFAULT_CHAT_SETTINGS.model).toBe(DEFAULT_AI_MODEL)
    })

    it('should have valid memory summary count', () => {
      expect(DEFAULT_CHAT_SETTINGS.memorySummaryCount).toBeGreaterThan(0)
      expect(DEFAULT_CHAT_SETTINGS.memorySummaryCount).toBeLessThanOrEqual(10)
    })

    it('should have a valid tone', () => {
      const validTones = Object.values(RESPONSE_TONES)
      expect(validTones).toContain(DEFAULT_CHAT_SETTINGS.tone)
    })
  })

  describe('PERFORMANCE_THRESHOLDS', () => {
    it('should have required timeout properties', () => {
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty('API_TIMEOUT')
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty('STREAM_TIMEOUT')
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty('MAX_RETRIES')
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty('RETRY_DELAY')
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty('MAX_MESSAGE_LENGTH')
    })

    it('should have reasonable timeout values', () => {
      expect(PERFORMANCE_THRESHOLDS.API_TIMEOUT).toBeGreaterThan(5000) // > 5 seconds
      expect(PERFORMANCE_THRESHOLDS.STREAM_TIMEOUT).toBeGreaterThan(30000) // > 30 seconds
      expect(PERFORMANCE_THRESHOLDS.MAX_RETRIES).toBeGreaterThan(0)
      expect(PERFORMANCE_THRESHOLDS.RETRY_DELAY).toBeGreaterThan(0)
      expect(PERFORMANCE_THRESHOLDS.MAX_MESSAGE_LENGTH).toBeGreaterThan(100)
    })

    it('should have stream timeout greater than API timeout', () => {
      expect(PERFORMANCE_THRESHOLDS.STREAM_TIMEOUT).toBeGreaterThan(PERFORMANCE_THRESHOLDS.API_TIMEOUT)
    })
  })

  describe('FILE_UPLOAD', () => {
    it('should have file size and storage limits', () => {
      expect(FILE_UPLOAD).toHaveProperty('MAX_FILE_SIZE')
      expect(FILE_UPLOAD).toHaveProperty('MAX_TOTAL_STORAGE')
      expect(FILE_UPLOAD).toHaveProperty('ALLOWED_MIME_TYPES')
      expect(FILE_UPLOAD).toHaveProperty('COST_PER_UPLOAD')
    })

    it('should have reasonable file size limits', () => {
      expect(FILE_UPLOAD.MAX_FILE_SIZE).toBeGreaterThan(1024 * 1024) // > 1MB
      expect(FILE_UPLOAD.MAX_TOTAL_STORAGE).toBeGreaterThan(FILE_UPLOAD.MAX_FILE_SIZE)
    })

    it('should have allowed mime types array', () => {
      expect(Array.isArray(FILE_UPLOAD.ALLOWED_MIME_TYPES)).toBe(true)
      expect(FILE_UPLOAD.ALLOWED_MIME_TYPES.length).toBeGreaterThan(0)
    })

    it('should include common image types', () => {
      expect(FILE_UPLOAD.ALLOWED_MIME_TYPES).toContain('image/jpeg')
      expect(FILE_UPLOAD.ALLOWED_MIME_TYPES).toContain('image/png')
    })

    it('should have valid cost per upload', () => {
      expect(typeof FILE_UPLOAD.COST_PER_UPLOAD).toBe('number')
      expect(FILE_UPLOAD.COST_PER_UPLOAD).toBeGreaterThan(0)
    })
  })

  describe('API_ENDPOINTS', () => {
    it('should have required endpoints', () => {
      expect(API_ENDPOINTS).toHaveProperty('CHAT')
      expect(API_ENDPOINTS).toHaveProperty('MODELS')
      expect(API_ENDPOINTS).toHaveProperty('SESSIONS')
      expect(API_ENDPOINTS).toHaveProperty('GENERATE_TITLE')
    })

    it('should have valid endpoint paths', () => {
      Object.values(API_ENDPOINTS).forEach(endpoint => {
        expect(typeof endpoint).toBe('string')
        expect(endpoint).toMatch(/^\/api\//)
      })
    })
  })

  describe('CHAT_CONFIG', () => {
    it('should have message and title configuration', () => {
      expect(CHAT_CONFIG).toHaveProperty('TITLE_GENERATION_MESSAGE_LIMIT')
      expect(CHAT_CONFIG).toHaveProperty('TITLE_GENERATION_TRIGGER_COUNT')
      expect(CHAT_CONFIG).toHaveProperty('WELCOME_MESSAGE')
    })

    it('should have reasonable title generation limits', () => {
      expect(CHAT_CONFIG.TITLE_GENERATION_MESSAGE_LIMIT).toBeGreaterThan(0)
      expect(CHAT_CONFIG.TITLE_GENERATION_TRIGGER_COUNT).toBeGreaterThan(0)
      expect(CHAT_CONFIG.TITLE_GENERATION_MESSAGE_LIMIT).toBeGreaterThan(CHAT_CONFIG.TITLE_GENERATION_TRIGGER_COUNT)
    })

    it('should have a welcome message', () => {
      expect(typeof CHAT_CONFIG.WELCOME_MESSAGE).toBe('string')
      expect(CHAT_CONFIG.WELCOME_MESSAGE.length).toBeGreaterThan(0)
    })
  })

  describe('RESPONSE_TONES', () => {
    it('should have required tone options', () => {
      expect(RESPONSE_TONES).toHaveProperty('MATCH_USER')
      expect(RESPONSE_TONES).toHaveProperty('PROFESSIONAL')
      expect(RESPONSE_TONES).toHaveProperty('CASUAL')
    })

    it('should have string values', () => {
      Object.values(RESPONSE_TONES).forEach(tone => {
        expect(typeof tone).toBe('string')
        expect(tone.length).toBeGreaterThan(0)
      })
    })

    it('should have unique values', () => {
      const tones = Object.values(RESPONSE_TONES)
      const uniqueTones = new Set(tones)
      expect(uniqueTones.size).toBe(tones.length)
    })
  })
})