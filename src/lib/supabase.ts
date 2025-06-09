import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

/**
 * ☁️ Supabase Client Configuration
 * 
 * Provides a fully configured Supabase client with proper environment validation
 * and fallback handling for development scenarios.
 */

// Create a mock client for development when API keys are not available
const createMockClient = () => {
  console.warn('⚠️ Using mock Supabase client - storage functionality disabled')
  console.warn('💡 Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local')
  
  return {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
    }),
    auth: {
      signIn: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      getUser: () => Promise.resolve({ data: null, error: null }),
    },
  }
}

// Initialize Supabase client with environment check
const hasSupabaseConfig = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const supabase = hasSupabaseConfig
  ? createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    )
  : createMockClient()

// 🔍 Development logging
if (process.env.NODE_ENV === 'development') {
  console.log('☁️ Supabase Configuration:', {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    isConfigured: hasSupabaseConfig,
  })
}

// Re-export the Database type for convenience
export type { Database } 