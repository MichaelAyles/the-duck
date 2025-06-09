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