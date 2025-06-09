import { z } from 'zod';

/**
 * 🔧 Environment Configuration Validation
 * 
 * This module validates all environment variables required for The Duck
 * to function properly. It provides type safety and clear error messages
 * when configuration is missing or invalid.
 */

// 🎯 Define the schema for environment variables
const envSchema = z.object({
  // AI Service Configuration
  OPENROUTER_API_KEY: z
    .string()
    .min(1, 'OpenRouter API key is required')
    .refine(
      (key) => key.startsWith('sk-or-v1-') || key.startsWith('sk_or_'),
      'Invalid OpenRouter API key format (should start with sk-or-v1- or sk_or_)'
    )
    .refine(
      (key) => key.length >= 45,
      'OpenRouter API key appears to be too short'
    ),

  // Database Configuration
  DATABASE_URL: z
    .string()
    .min(1, 'Database URL is required')
    .url('Database URL must be a valid URL')
    .startsWith('postgresql://', 'Database must be PostgreSQL'),

  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, 'Supabase URL is required')
    .url('Supabase URL must be a valid URL')
    .refine(url => url.includes('.supabase.co'), 'Invalid Supabase URL format'),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'Supabase anonymous key is required')
    .startsWith('eyJ', 'Invalid Supabase key format (should be JWT)'),

  // Application Configuration
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('App URL must be a valid URL')
    .optional()
    .default('http://localhost:12000'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development'),

  // Optional Configuration
  DEBUG: z
    .string()
    .optional()
    .transform(val => val === 'true'),

  PORT: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 12000),

  DB_LOGGING: z
    .string()
    .optional()
    .transform(val => val === 'true'),
});

// 🔍 Extract the TypeScript type from the schema
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * 🛡️ Validate and parse environment variables
 * 
 * This function validates all environment variables against our schema
 * and provides clear error messages if anything is missing or invalid.
 */
export function validateEnv(): EnvConfig {
  try {
    const env = envSchema.parse(process.env);
    
    // 🎉 Success message in development
    if (env.NODE_ENV === 'development' && env.DEBUG) {
      console.log('✅ Environment validation successful!');
      console.log('🔧 Configuration loaded:', {
        nodeEnv: env.NODE_ENV,
        hasOpenRouter: !!env.OPENROUTER_API_KEY,
        hasDatabase: !!env.DATABASE_URL,
        hasSupabase: !!env.NEXT_PUBLIC_SUPABASE_URL,
        appUrl: env.NEXT_PUBLIC_APP_URL,
        port: env.PORT,
      });
    }
    
    return env;
  } catch (error) {
    // 🚨 Clear error messages for missing configuration
    console.error('❌ Environment validation failed!');
    console.error('🔧 Please check your .env.local file');
    
    if (error instanceof z.ZodError) {
      console.error('\n📋 Missing or invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  • ${err.path.join('.')}: ${err.message}`);
      });
      
      console.error('\n💡 Setup instructions:');
      console.error('  1. Copy .env.example to .env.local');
      console.error('  2. Fill in your actual API keys and credentials');
      console.error('  3. Restart the development server');
      console.error('\n📚 See .env.example for detailed setup instructions');
    }
    
    throw new Error('Environment validation failed. Check the console for details.');
  }
}

/**
 * 🏗️ Get validated environment configuration
 * 
 * Use this to access environment variables with full type safety
 */
let _env: EnvConfig | null = null;

export const getEnv = (): EnvConfig => {
  if (_env === null) {
    _env = validateEnv();
  }
  return _env;
};

// Legacy export for backwards compatibility - use getEnv() instead
export const env = new Proxy({} as EnvConfig, {
  get(target, prop) {
    return getEnv()[prop as keyof EnvConfig];
  }
});

/**
 * 🔍 Environment status checker for debugging
 */
export function getEnvStatus() {
  const envConfig = getEnv();
  return {
    isProduction: envConfig.NODE_ENV === 'production',
    isDevelopment: envConfig.NODE_ENV === 'development',
    isTest: envConfig.NODE_ENV === 'test',
    hasRequiredKeys: !!(
      envConfig.OPENROUTER_API_KEY &&
      envConfig.DATABASE_URL &&
      envConfig.NEXT_PUBLIC_SUPABASE_URL &&
      envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    debugMode: envConfig.DEBUG || false,
    port: envConfig.PORT,
    appUrl: envConfig.NEXT_PUBLIC_APP_URL,
  };
}

/**
 * 🎯 Specific environment checks for different services
 */
export const envChecks = {
  hasOpenRouter: () => {
    try {
      return !!getEnv().OPENROUTER_API_KEY;
    } catch {
      return !!process.env.OPENROUTER_API_KEY;
    }
  },
  hasDatabase: () => {
    try {
      return !!getEnv().DATABASE_URL;
    } catch {
      return !!process.env.DATABASE_URL;
    }
  },
  hasSupabase: () => {
    try {
      const env = getEnv();
      return !!(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    } catch {
      return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    }
  },
  isConfigured: () => envChecks.hasOpenRouter() && envChecks.hasDatabase() && envChecks.hasSupabase(),
}; 