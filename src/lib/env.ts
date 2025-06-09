import { z } from 'zod';

/**
 * 🌍 Environment Configuration & Validation
 * 
 * Centralized environment variable management with runtime validation
 * Ensures all required configuration is present and valid
 */

// Environment schema with validation rules
const envSchema = z.object({
  // OpenRouter API Configuration
  OPENROUTER_API_KEY: z
    .string()
    .min(1, 'OpenRouter API key is required')
    .startsWith('sk-or-', 'OpenRouter API key must start with sk-or-'),

  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('Supabase URL must be a valid URL')
    .refine(
      (url) => url.includes('supabase.co'),
      'Supabase URL must be a valid Supabase project URL'
    ),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'Supabase anonymous key is required'),

  // App Configuration
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('App URL must be a valid URL')
    .optional(),

  // Development Configuration
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  DB_LOGGING: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

// Environment configuration type
export type EnvConfig = z.infer<typeof envSchema>;

// Cached environment configuration
let envConfig: EnvConfig | null = null;

/**
 * Get validated environment configuration
 * Caches the result for performance
 */
export function getEnv(): EnvConfig {
  if (envConfig) {
    return envConfig;
  }

  try {
    envConfig = envSchema.parse({
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NODE_ENV: process.env.NODE_ENV,
      DB_LOGGING: process.env.DB_LOGGING,
    });

    return envConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(
        `Environment validation failed:\n${missingVars.join('\n')}\n\n` +
        'Please check your .env.local file and ensure all required variables are set.'
      );
    }
    throw error;
  }
}

/**
 * Validate environment configuration
 * Throws an error if validation fails
 */
export function validateEnv(): void {
  getEnv();
}

/**
 * Check if all required environment variables are present
 * Returns true if valid, false otherwise
 */
export function isEnvValid(): boolean {
  try {
    getEnv();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get environment validation status with details
 */
export function getEnvStatus(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const env = getEnv();
    
    // Check for development warnings
    if (env.NODE_ENV === 'development') {
      if (!env.NEXT_PUBLIC_APP_URL) {
        warnings.push('NEXT_PUBLIC_APP_URL not set - OAuth redirects may not work in production');
      }
    }

    return { isValid: true, errors, warnings };
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map(err => `${err.path.join('.')}: ${err.message}`));
    } else {
      errors.push(error instanceof Error ? error.message : 'Unknown validation error');
    }
    
    return { isValid: false, errors, warnings };
  }
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  try {
    const env = getEnv();
    return !!(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  } catch {
    return false;
  }
}

/**
 * Check if OpenRouter is configured
 */
export function isOpenRouterConfigured(): boolean {
  try {
    const env = getEnv();
    return !!env.OPENROUTER_API_KEY;
  } catch {
    return false;
  }
}

/**
 * Get configuration summary for debugging
 */
export function getConfigSummary(): Record<string, string | boolean> {
  try {
    const env = getEnv();
    return {
      nodeEnv: env.NODE_ENV,
      hasOpenRouterKey: !!env.OPENROUTER_API_KEY,
      hasSupabaseUrl: !!env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasAppUrl: !!env.NEXT_PUBLIC_APP_URL,
      dbLogging: env.DB_LOGGING || false,
    };
  } catch {
    return {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      dbLogging: false,
    };
  }
} 