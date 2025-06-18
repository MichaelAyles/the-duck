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
          user_id: string
          title: string
          messages: Json
          model: string
          created_at: string
          updated_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          messages?: Json
          model?: string
          created_at?: string
          updated_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          user_id?: string
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
      user_preferences: {
        Row: {
          id: string
          user_id: string
          starred_models: string[]
          theme: string
          default_model: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          starred_models?: string[]
          theme?: string
          default_model?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          starred_models?: string[]
          theme?: string
          default_model?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_credits: {
        Row: {
          id: string
          user_id: string
          total_credits: number
          used_credits: number
          credit_limit_period: 'daily' | 'weekly' | 'monthly'
          last_reset_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          total_credits?: number
          used_credits?: number
          credit_limit_period?: 'daily' | 'weekly' | 'monthly'
          last_reset_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          total_credits?: number
          used_credits?: number
          credit_limit_period?: 'daily' | 'weekly' | 'monthly'
          last_reset_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_usage: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          model: string | null
          token_count: number
          timestamp: string
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          model?: string | null
          token_count?: number
          timestamp?: string
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          model?: string | null
          token_count?: number
          timestamp?: string
          metadata?: Json
        }
      }
      user_learning_preferences_v2: {
        Row: {
          id: string
          user_id: string
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          preferences?: Json
          created_at?: string
          updated_at?: string
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