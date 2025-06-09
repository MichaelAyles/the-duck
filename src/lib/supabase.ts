import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Create a mock client for development when API keys are not available
const createMockClient = () => {
  return {
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      upsert: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
    auth: {
      signIn: () => ({ data: null, error: null }),
      signOut: () => ({ error: null }),
      getUser: () => ({ data: null, error: null }),
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

// Database schema types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      chat_sessions: {
        Row: {
          id: string
          title: string
          messages: Json
          model: string
          created_at: string
          updated_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          title: string
          messages: Json
          model: string
          created_at?: string
          updated_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          title?: string
          messages?: Json
          model?: string
          created_at?: string
          updated_at?: string
          is_active?: boolean
        }
      }
      chat_summaries: {
        Row: {
          id: string
          session_id: string
          summary: string
          key_topics: string[]
          user_preferences: Json
          writing_style_analysis: Json
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          summary: string
          key_topics: string[]
          user_preferences: Json
          writing_style_analysis: Json
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          summary?: string
          key_topics?: string[]
          user_preferences?: Json
          writing_style_analysis?: Json
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 