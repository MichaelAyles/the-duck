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
          user_id: string | null
        }
        Insert: {
          id?: string
          title: string
          messages: Json
          model: string
          created_at?: string
          updated_at?: string
          is_active?: boolean
          user_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          messages?: Json
          model?: string
          created_at?: string
          updated_at?: string
          is_active?: boolean
          user_id?: string | null
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
      user_preferences: {
        Row: {
          user_id: string
          preferences: Json
          updated_at: string
        }
        Insert: {
          user_id: string
          preferences: Json
          updated_at?: string
        }
        Update: {
          user_id?: string
          preferences?: Json
          updated_at?: string
        }
      }
      user_credits: {
        Row: {
          user_id: string
          credit_limit: number
          credits_used: number
          reset_period: 'daily' | 'weekly' | 'monthly' | 'never'
          last_reset: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          credit_limit?: number
          credits_used?: number
          reset_period?: 'daily' | 'weekly' | 'monthly' | 'never'
          last_reset?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          credit_limit?: number
          credits_used?: number
          reset_period?: 'daily' | 'weekly' | 'monthly' | 'never'
          last_reset?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_usage: {
        Row: {
          id: string
          user_id: string
          session_id: string | null
          model: string
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
          prompt_cost: number
          completion_cost: number
          total_cost: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id?: string | null
          model: string
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
          prompt_cost: number
          completion_cost: number
          total_cost: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string | null
          model?: string
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          prompt_cost?: number
          completion_cost?: number
          total_cost?: number
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