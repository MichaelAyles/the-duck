import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Create a mock client for development when API keys are not available
const createMockClient = () => {
  console.warn('Using mock Supabase client - storage functionality disabled')
  
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

// Initialize Supabase client with fallback to mock client
export const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  : createMockClient()

console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Re-export the Database type for convenience
export type { Database } 