-- 🦆 The Duck - Enhanced Production Migration
-- This migration adds performance optimizations, security, and database triggers
-- Run this after the base schema migration (0000_flippant_korg.sql)

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_created_at" ON "chat_sessions"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_is_active" ON "chat_sessions"("is_active");
CREATE INDEX IF NOT EXISTS "idx_chat_summaries_session_id" ON "chat_summaries"("session_id");
CREATE INDEX IF NOT EXISTS "idx_chat_summaries_created_at" ON "chat_summaries"("created_at" DESC);

-- Enable Row Level Security (RLS) for future authentication
ALTER TABLE "chat_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_summaries" ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations for now (restrict these when adding auth)
DROP POLICY IF EXISTS "Allow all operations on chat_sessions" ON "chat_sessions";
CREATE POLICY "Allow all operations on chat_sessions" ON "chat_sessions"
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on chat_summaries" ON "chat_summaries";
CREATE POLICY "Allow all operations on chat_summaries" ON "chat_summaries"
    FOR ALL USING (true) WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on chat_sessions
DROP TRIGGER IF EXISTS "update_chat_sessions_updated_at" ON "chat_sessions";
CREATE TRIGGER "update_chat_sessions_updated_at" 
    BEFORE UPDATE ON "chat_sessions" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE "chat_sessions" IS 'Stores chat conversation sessions with all messages as JSONB';
COMMENT ON TABLE "chat_summaries" IS 'Stores AI-generated summaries and analysis of completed chat sessions';

COMMENT ON COLUMN "chat_sessions"."messages" IS 'Array of message objects stored as JSONB for flexibility';
COMMENT ON COLUMN "chat_sessions"."is_active" IS 'Whether the chat session is currently active (not ended)';
COMMENT ON COLUMN "chat_summaries"."key_topics" IS 'Array of key topics extracted from the conversation';
COMMENT ON COLUMN "chat_summaries"."user_preferences" IS 'Detected user preferences in JSONB format';
COMMENT ON COLUMN "chat_summaries"."writing_style_analysis" IS 'Analysis of user writing style preferences'; 