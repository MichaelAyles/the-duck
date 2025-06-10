import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

/**
 * ☁️ Supabase Client Configuration
 * 
 * Provides a fully configured Supabase client with proper environment validation
 * and SSR support for seamless client-server authentication.
 */

// Initialize Supabase client - environment variables are required
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Re-export the Database type for convenience
export type { Database } 