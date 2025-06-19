/**
 * 🔒 Security Utilities for The Duck
 * 
 * Essential security measures for production deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRateLimiter } from './redis';
import { logger } from './logger';

// 🛡️ Security Configuration
export const SECURITY_CONFIG = {
  // Rate limiting (requests per window)
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: {
      CHAT: 100,      // Chat completions
      MODELS: 100,    // Model fetching (increased for development)
      API: 500,       // General API calls (increased for development)
    }
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

// 🚦 Rate Limiting - Now using Redis for distributed rate limiting
// The old InMemoryRateLimiter has been replaced with Redis-based rate limiting
// to work properly in serverless environments like Vercel

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
      attachments: z.array(z.object({
        id: z.string().uuid(),
        file_name: z.string().min(1).max(255),
        file_type: z.string().min(1).max(50),
        file_size: z.number().int().positive().max(10485760), // 10MB limit
        mime_type: z.string().min(1).max(100),
        url: z.string().url().optional(),
      })).optional(),
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
    
    tone: z.string().optional().default('match-user'),
    
    memoryEnabled: z.boolean().optional().default(true),
    memorySummaryCount: z.number().min(1).max(10).optional().default(3),
  }),

  /**
   * Sanitize user input to prevent XSS and injection attacks
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
      .replace(/on\w+='[^']*'/gi, '') // Remove event handlers (single quotes)
      .trim();
  },

  /**
   * Validate session ID format
   */
  validateSessionId(sessionId: string): string | null {
    if (!sessionId) return null;
    
    // Basic format validation
    if (!/^[a-zA-Z0-9\-_]{8,50}$/.test(sessionId)) {
      return null;
    }
    
    return sessionId;
  }
};

// 🔧 Security Middleware
export function withSecurity(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Add security headers to response
      const response = await handler(req);
      
      // Add security headers
      Object.entries(SECURITY_CONFIG.SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    } catch (error) {
      logger.error('Security middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// 🚦 Rate Limiting Middleware
export function withRateLimit(
  maxRequests: number,
  windowMs: number = SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS
) {
  // Convert windowMs to Duration format for Upstash (e.g., "15m" for 15 minutes)
  const windowDuration = windowMs >= 60000 
    ? `${Math.ceil(windowMs / 60000)}m` as const
    : `${Math.ceil(windowMs / 1000)}s` as const;
  
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      try {
        // Get client identifier (IP address)
        const clientId = req.headers.get('x-forwarded-for')?.split(',')[0] || 
          req.headers.get('x-real-ip') || 
          req.headers.get('cf-connecting-ip') ||
          'unknown';
        
        // Create rate limiter for this endpoint
        const rateLimiter = createRateLimiter({
          requests: maxRequests,
          window: windowDuration,
          prefix: `rl:${req.nextUrl.pathname}`,
        });
        
        // Check rate limit
        const { success, limit, reset, remaining } = await rateLimiter.limit(clientId);
        
        if (!success) {
          return NextResponse.json(
            { 
              error: 'Rate limit exceeded',
              message: 'Too many requests. Please try again later.',
              resetTime: new Date(reset).toISOString()
            },
            { 
              status: 429,
              headers: {
                'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
                'X-RateLimit-Limit': limit.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': Math.ceil(reset / 1000).toString(),
                ...SECURITY_CONFIG.SECURITY_HEADERS
              }
            }
          );
        }
        
        // Add rate limit headers to successful responses
        const response = await handler(req);
        
        response.headers.set('X-RateLimit-Limit', limit.toString());
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
        response.headers.set('X-RateLimit-Reset', Math.ceil(reset / 1000).toString());
        
        return response;
      } catch (error) {
        logger.error('Rate limiting error:', error);
        // If Redis is unavailable, allow the request but log the error
        return handler(req);
      }
    };
  };
}

// 🔐 API Key Validation Middleware
export function withApiKeyValidation(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Clean API key (remove quotes)
    const apiKey = process.env.OPENROUTER_API_KEY?.replace(/^["']|["']$/g, '');
    
    if (!apiKey) {
      logger.error('🚨 OpenRouter API key not configured');
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }
    
    if (!ApiKeySecurity.validateOpenRouterKey(apiKey)) {
      logger.error('🚨 Invalid OpenRouter API key format');
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
        
        logger.error('Input validation error:', error);
        return NextResponse.json(
          { error: 'Invalid request format' },
          { status: 400 }
        );
      }
    };
  };
}

// 🔍 Basic Security Audit Logger
export const SecurityAudit = {
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
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    };
    
    // Log for analytics and cost tracking
    logger.security('📊 API Usage:', JSON.stringify(logEntry));
  }
};

// Export security configuration for external use
export { SECURITY_CONFIG as SecurityConfig }; 