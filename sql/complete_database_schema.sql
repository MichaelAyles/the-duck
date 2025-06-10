-- 🦆 The Duck - Complete Database Schema
-- Enhanced schema with user preferences and primary model support

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    messages JSONB NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create chat_summaries table
CREATE TABLE IF NOT EXISTS public.chat_summaries (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    key_topics TEXT[] NOT NULL DEFAULT '{}',
    user_preferences JSONB NOT NULL DEFAULT '{}',
    writing_style_analysis JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Create user_preferences table with primary model support
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{
        "starredModels": ["google/gemini-2.5-flash-preview-05-20", "google/gemini-2.5-pro-preview-05-06", "deepseek/deepseek-chat-v3-0324", "anthropic/claude-sonnet-4", "openai/gpt-4o-mini"],
        "primaryModel": "google/gemini-2.5-flash-preview-05-20",
        "theme": "system",
        "responseTone": "match",
        "storageEnabled": true,
        "explicitPreferences": {},
        "writingStyle": {
            "verbosity": "medium",
            "formality": "neutral",
            "technicalLevel": "intermediate",
            "preferredTopics": [],
            "dislikedTopics": []
        }
    }',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON public.chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_is_active ON public.chat_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_session_id ON public.chat_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_created_at ON public.chat_summaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first
DROP POLICY IF EXISTS "Allow all operations on chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow all operations on chat_summaries" ON public.chat_summaries;
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can view own chat summaries" ON public.chat_summaries;
DROP POLICY IF EXISTS "Users can insert own chat summaries" ON public.chat_summaries;
DROP POLICY IF EXISTS "Users can update own chat summaries" ON public.chat_summaries;
DROP POLICY IF EXISTS "Users can delete own chat summaries" ON public.chat_summaries;
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;

-- Create RLS policies for chat_sessions
CREATE POLICY "Users can view own chat sessions" ON public.chat_sessions
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own chat sessions" ON public.chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions" ON public.chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions" ON public.chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for chat_summaries
CREATE POLICY "Users can view own chat summaries" ON public.chat_summaries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_sessions 
            WHERE chat_sessions.id = chat_summaries.session_id 
            AND (chat_sessions.user_id = auth.uid() OR chat_sessions.user_id IS NULL)
        )
    );

CREATE POLICY "Users can insert own chat summaries" ON public.chat_summaries
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_sessions 
            WHERE chat_sessions.id = chat_summaries.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own chat summaries" ON public.chat_summaries
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.chat_sessions 
            WHERE chat_sessions.id = chat_summaries.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own chat summaries" ON public.chat_summaries
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.chat_sessions 
            WHERE chat_sessions.id = chat_summaries.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- Create RLS policies for user_preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- Optional: Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON public.chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON public.user_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.chat_sessions TO authenticated;
GRANT ALL ON public.chat_summaries TO authenticated;
GRANT ALL ON public.user_preferences TO authenticated;

-- Add helpful comments
COMMENT ON TABLE public.chat_sessions IS 'Stores chat conversations with messages, model info, and user association';
COMMENT ON TABLE public.chat_summaries IS 'Stores AI-generated summaries and analysis of completed chat sessions';
COMMENT ON TABLE public.user_preferences IS 'Stores user preferences including starred models, primary model, theme, and writing style';
COMMENT ON COLUMN public.chat_sessions.user_id IS 'User who owns this chat session - required for RLS policies';
COMMENT ON COLUMN public.user_preferences.preferences IS 'User preferences stored as JSONB including starredModels, primaryModel, theme, responseTone, storageEnabled, explicitPreferences, and writingStyle';

-- Migration for existing data (if updating existing database)
-- Update existing user preferences to include primaryModel if missing
UPDATE public.user_preferences 
SET preferences = preferences || jsonb_build_object(
    'primaryModel', 
    COALESCE(
        preferences->'starredModels'->0,  -- Use first starred model if exists
        '"google/gemini-2.5-flash-preview-05-20"'::jsonb  -- Default to Gemini Flash
    )
)
WHERE preferences ? 'starredModels' 
AND NOT (preferences ? 'primaryModel');

-- For any preferences that don't have starredModels yet, add both
UPDATE public.user_preferences 
SET preferences = preferences || jsonb_build_object(
    'starredModels', 
    '["google/gemini-2.5-flash-preview-05-20", "google/gemini-2.5-pro-preview-05-06", "deepseek/deepseek-chat-v3-0324", "anthropic/claude-sonnet-4", "openai/gpt-4o-mini"]'::jsonb,
    'primaryModel', 
    '"google/gemini-2.5-flash-preview-05-20"'::jsonb
)
WHERE NOT (preferences ? 'starredModels');

-- Verification query (uncomment to check results)
-- SELECT 
--     user_id,
--     preferences->'primaryModel' as primary_model,
--     preferences->'starredModels' as starred_models
-- FROM public.user_preferences; 