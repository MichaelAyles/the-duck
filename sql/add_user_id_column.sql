-- 🔧 Migration: Add user_id column to chat_sessions table
-- This fixes the missing user_id column error

-- Add user_id column to chat_sessions table
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);

-- Update RLS policies to use user_id (recreate them to ensure they work)
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON public.chat_sessions;

-- Create new RLS policies for chat_sessions
CREATE POLICY "Users can view own chat sessions" ON public.chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions" ON public.chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions" ON public.chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions" ON public.chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Update any existing chat sessions to allow anonymous access temporarily
-- (Optional: You may want to delete existing sessions or assign them to a specific user)
-- For now, we'll leave existing sessions with NULL user_id which won't be accessible due to RLS

COMMENT ON COLUMN public.chat_sessions.user_id IS 'User who owns this chat session - required for RLS policies'; 