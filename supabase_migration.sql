-- 🦆 The Duck - Supabase Migration (Legacy)
-- This is the original Supabase migration for reference
-- For new deployments, use the Drizzle migrations instead

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    messages JSONB NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Create chat_summaries table
CREATE TABLE IF NOT EXISTS public.chat_summaries (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    key_topics TEXT[] NOT NULL DEFAULT '{}',
    user_preferences JSONB NOT NULL DEFAULT '{}',
    writing_style_analysis JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON public.chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_is_active ON public.chat_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_session_id ON public.chat_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_created_at ON public.chat_summaries(created_at DESC);

-- Enable Row Level Security (RLS) if you plan to add authentication later
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations for now (you can restrict these later)
-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Allow all operations on chat_sessions" ON public.chat_sessions;
CREATE POLICY "Allow all operations on chat_sessions" ON public.chat_sessions
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on chat_summaries" ON public.chat_summaries;
CREATE POLICY "Allow all operations on chat_summaries" ON public.chat_summaries
    FOR ALL USING (true) WITH CHECK (true);

-- Optional: Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON public.chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 