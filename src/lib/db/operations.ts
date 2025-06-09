import { SupabaseDatabaseService } from './supabase-operations';

/**
 * 🗄️ Database Operations Service
 * 
 * Unified database operations using Supabase client
 * Provides a clean interface for chat persistence and retrieval
 */

// Re-export the Supabase service as the main DatabaseService
export const DatabaseService = SupabaseDatabaseService;

// Re-export types for compatibility
export type {
  ChatSession,
  NewChatSession,
  ChatSummary,
  NewChatSummary,
} from './supabase-operations'; 