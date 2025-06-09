/**
 * 🔒 Security Utilities for The Duck
 * 
 * Comprehensive security measures for production deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 🛡️ Security Configuration
export const SECURITY_CONFIG = {
  // Rate limiting (requests per window)
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: {
      CHAT: 100,      // Chat completions
      MODELS: 20,     // Model fetching
      API: 200,       // General API calls
    }
  },
  
  // CORS configuration
  CORS: {
    ALLOWED_ORIGINS: [
      'http://localhost:12000',
      'http://localhost:3000',
      'https://the-duck.vercel.app',
      // Add production domains here
    ],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
  },
  
  // Input validation limits
  INPUT_LIMITS: {
    MESSAGE_LENGTH: 10000,   // Max message length
    MESSAGES_COUNT: 100,     // Max messages in conversation
    SESSION_ID_LENGTH: 50,   // Max session ID length
    MODEL_ID_LENGTH: 100,    // Max model ID length
  },
  
  // Security headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://openrouter.ai https://*.supabase.co;",
  }
};

// 🔐 API Key Security
export class ApiKeySecurity {
  /**
   * Validate OpenRouter API key format
   */
  static validateOpenRouterKey(apiKey: string): boolean {
    if (!apiKey) return false;
    
    // Check format: should start with sk-or-v1-
    const validFormat = /^sk-or-v1-[a-zA-Z0-9-_]{32,}$/.test(apiKey);
    
    // Check minimum length (realistic API key length)
    const validLength = apiKey.length >= 45;
    
    return validFormat && validLength;
  }
  
  /**
   * Validate Supabase key format (JWT)
   */
  static validateSupabaseKey(key: string): boolean {
    if (!key) return false;
    
    // Basic JWT format check (3 parts separated by dots)
    const parts = key.split('.');
    if (parts.length !== 3) return false;
    
    // Check if it starts with eyJ (base64 encoded JSON header)
    return key.startsWith('eyJ');
  }
  
  /**
   * Sanitize API key for logging (show only prefix)
   */
  static sanitizeForLogging(apiKey: string): string {
    if (!apiKey || apiKey.length < 10) return '[INVALID]';
    return `${apiKey.substring(0, 10)}...`;
  }
}

// 🚦 Rate Limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  
  isRateLimited(
    identifier: string, 
    maxRequests: number, 
    windowMs: number = SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS
  ): boolean {
    const now = Date.now();
    const key = identifier;
    const entry = this.store.get(key);
    
    // Clean up expired entries
    if (entry && now > entry.resetTime) {
      this.store.delete(key);
    }
    
    const currentEntry = this.store.get(key);
    
    if (!currentEntry) {
      // First request in window
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return false;
    }
    
    if (currentEntry.count >= maxRequests) {
      return true;
    }
    
    // Increment count
    currentEntry.count++;
    this.store.set(key, currentEntry);
    return false;
  }
  
  getRemainingRequests(
    identifier: string,
    maxRequests: number
  ): number {
    const entry = this.store.get(identifier);
    if (!entry) return maxRequests;
    return Math.max(0, maxRequests - entry.count);
  }
  
  getResetTime(identifier: string): number | null {
    const entry = this.store.get(identifier);
    return entry?.resetTime || null;
  }
}

export const rateLimiter = new InMemoryRateLimiter();

// 🔍 Input Validation & Sanitization
export const InputValidation = {
  /**
   * Chat message validation schema
   */
  chatMessageSchema: z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
      .min(1, 'Message content cannot be empty')
      .max(SECURITY_CONFIG.INPUT_LIMITS.MESSAGE_LENGTH, 'Message too long'),
  }),
  
  /**
   * Chat request validation schema
   */
  chatRequestSchema: z.object({
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1).max(SECURITY_CONFIG.INPUT_LIMITS.MESSAGE_LENGTH),
    })).min(1).max(SECURITY_CONFIG.INPUT_LIMITS.MESSAGES_COUNT),
    
    model: z.string()
      .min(1)
      .max(SECURITY_CONFIG.INPUT_LIMITS.MODEL_ID_LENGTH)
      .regex(/^[a-zA-Z0-9\-_\/\.]+$/, 'Invalid model ID format'),
    
    sessionId: z.string()
      .max(SECURITY_CONFIG.INPUT_LIMITS.SESSION_ID_LENGTH)
      .regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid session ID format')
      .optional(),
    
    stream: z.boolean().optional().default(true),
    
    options: z.object({
      temperature: z.number().min(0).max(2).optional(),
      max_tokens: z.number().min(1).max(8192).optional(),
      top_p: z.number().min(0).max(1).optional(),
      frequency_penalty: z.number().min(-2).max(2).optional(),
      presence_penalty: z.number().min(-2).max(2).optional(),
    }).optional().default({}),
    
    tone: z.enum(['match-user', 'duck']).optional().default('match-user'),
  }),
  
  /**
   * Sanitize user input to prevent XSS
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  },
  
  /**
   * Validate and sanitize session ID
   */
  validateSessionId(sessionId: string): string | null {
    if (!sessionId) return null;
    
    // Only allow alphanumeric, hyphens, and underscores
    const sanitized = sessionId.replace(/[^a-zA-Z0-9\-_]/g, '');
    
    if (sanitized.length === 0 || sanitized.length > SECURITY_CONFIG.INPUT_LIMITS.SESSION_ID_LENGTH) {
      return null;
    }
    
    return sanitized;
  },
};

// 🌐 CORS Security
export function createCORSHeaders(origin?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  
  // Check if origin is allowed
  if (origin && (
    SECURITY_CONFIG.CORS.ALLOWED_ORIGINS.includes(origin) ||
    process.env.NODE_ENV === 'development'
  )) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  
  headers['Access-Control-Allow-Methods'] = SECURITY_CONFIG.CORS.ALLOWED_METHODS.join(', ');
  headers['Access-Control-Allow-Headers'] = SECURITY_CONFIG.CORS.ALLOWED_HEADERS.join(', ');
  headers['Access-Control-Max-Age'] = '86400'; // 24 hours
  
  return headers;
}

// 🛡️ Security Middleware
export function withSecurity(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // 1. Add security headers
      const response = await handler(req);
      
      // Apply security headers
      Object.entries(SECURITY_CONFIG.SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      // Apply CORS headers
      const corsHeaders = createCORSHeaders(req.headers.get('origin') || undefined);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
      
    } catch (error) {
      console.error('Security middleware error:', error);
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { 
          status: 500,
          headers: SECURITY_CONFIG.SECURITY_HEADERS
        }
      );
    }
  };
}

// 🚦 Rate Limiting Middleware
export function withRateLimit(
  maxRequests: number,
  windowMs: number = SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS
) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      // Get client identifier (IP address)
      const clientId = req.ip || 
        req.headers.get('x-forwarded-for')?.split(',')[0] || 
        req.headers.get('x-real-ip') || 
        'unknown';
      
      // Check rate limit
      if (rateLimiter.isRateLimited(clientId, maxRequests, windowMs)) {
        const resetTime = rateLimiter.getResetTime(clientId);
        
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            resetTime: resetTime ? new Date(resetTime).toISOString() : null
          },
          { 
            status: 429,
            headers: {
              'Retry-After': Math.ceil(windowMs / 1000).toString(),
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': resetTime ? Math.ceil(resetTime / 1000).toString() : '',
              ...SECURITY_CONFIG.SECURITY_HEADERS
            }
          }
        );
      }
      
      // Add rate limit headers to successful responses
      const response = await handler(req);
      const remaining = rateLimiter.getRemainingRequests(clientId, maxRequests);
      const resetTime = rateLimiter.getResetTime(clientId);
      
      response.headers.set('X-RateLimit-Limit', maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      if (resetTime) {
        response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
      }
      
      return response;
    };
  };
}

// 🔐 API Key Validation Middleware
export function withApiKeyValidation(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      console.error('🚨 OpenRouter API key not configured');
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }
    
    if (!ApiKeySecurity.validateOpenRouterKey(apiKey)) {
      console.error('🚨 Invalid OpenRouter API key format');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }
    
    return handler(req);
  };
}

// 📝 Input Validation Middleware
export function withInputValidation<T>(schema: z.ZodSchema<T>) {
  return (handler: (req: NextRequest, validatedData: T) => Promise<NextResponse>) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      try {
        const body = await req.json();
        const validatedData = schema.parse(body);
        
        return handler(req, validatedData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            {
              error: 'Invalid request data',
              details: error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
              }))
            },
            { status: 400 }
          );
        }
        
        console.error('Input validation error:', error);
        return NextResponse.json(
          { error: 'Invalid request format' },
          { status: 400 }
        );
      }
    };
  };
}

// 🔍 Security Audit Logger
export const SecurityAudit = {
  logSuspiciousActivity(
    type: 'RATE_LIMIT_EXCEEDED' | 'INVALID_INPUT' | 'API_KEY_INVALID' | 'CORS_VIOLATION',
    details: Record<string, unknown>,
    req: NextRequest
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      ip: req.ip || req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      url: req.url,
      details,
    };
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      console.warn('🚨 Security Event:', JSON.stringify(logEntry));
      // TODO: Send to external monitoring service (Sentry, LogRocket, etc.)
    } else {
      console.warn('🚨 Security Event:', logEntry);
    }
  },
  
  logApiUsage(
    endpoint: string,
    model: string,
    tokenCount: number,
    req: NextRequest
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint,
      model,
      tokenCount,
      ip: req.ip || req.headers.get('x-forwarded-for') || 'unknown',
    };
    
    // Log for analytics and cost tracking
    console.log('📊 API Usage:', JSON.stringify(logEntry));
  }
};

// 🧪 Security Testing Utilities
export const SecurityTesting = {
  /**
   * Test rate limiting functionality
   */
  async testRateLimit(identifier: string, maxRequests: number): Promise<boolean> {
    // Simulate rapid requests
    for (let i = 0; i < maxRequests + 1; i++) {
      if (i === maxRequests) {
        // This should be rate limited
        return rateLimiter.isRateLimited(identifier, maxRequests);
      }
      rateLimiter.isRateLimited(identifier, maxRequests);
    }
    return false;
  },
  
  /**
   * Test input validation
   */
  testInputValidation(): boolean {
    try {
      // Test malicious inputs
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'onclick="alert(\'xss\')"',
        '"><script>alert("xss")</script>',
      ];
      
      maliciousInputs.forEach(input => {
        const sanitized = InputValidation.sanitizeInput(input);
        if (sanitized.includes('<script>') || sanitized.includes('javascript:')) {
          throw new Error('Input sanitization failed');
        }
      });
      
      return true;
    } catch {
      return false;
    }
  }
};

// Export security configuration for external use
export { SECURITY_CONFIG as SecurityConfig }; 