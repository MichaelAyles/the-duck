import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

/**
 * ☁️ Supabase Client Configuration
 * 
 * Provides a fully configured Supabase client with proper environment validation
 * and SSR support for seamless client-server authentication.
 */

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are missing. Authentication will be disabled.')
}

// Initialize Supabase client with fallback for missing env vars
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  : null

// Helper to check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

// Re-export the Database type for convenience
export type { Database } 