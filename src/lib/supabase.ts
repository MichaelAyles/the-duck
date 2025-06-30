import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'
import { logger } from '@/lib/logger'

/**
 * ☁️ Supabase Client Configuration
 * 
 * Provides a fully configured Supabase client with proper environment validation
 * and SSR support for seamless client-server authentication.
 */

// Validate and clean environment variables
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const rawSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabaseUrl = rawSupabaseUrl
  ?.replace(/^["']|["']$/g, '')
  ?.replace(/\/+$/, '')
const supabaseAnonKey = rawSupabaseAnonKey
  ?.replace(/^["']|["']$/g, '')

if (!supabaseUrl || !supabaseAnonKey) {
  logger.dev.warn('Supabase environment variables are missing. Authentication will be disabled.')
}

// Initialize Supabase client with fallback for missing env vars
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  : null

// Helper to check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

// Re-export the Database type for convenience
export type { Database } 