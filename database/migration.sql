-- 🦆 THE DUCK - COMPLETE DATABASE MIGRATION
-- ===========================================
-- This is the consolidated migration script for The Duck chat application
-- Run this entire script in your Supabase SQL Editor to set up the complete database

-- 🔧 CORE UTILITY FUNCTIONS
-- =========================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 📊 MAIN TABLES
-- ==============

-- 1. Chat Sessions Table
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

-- 2. Chat Summaries Table
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

-- 3. User Preferences Table
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

-- 4. User Learning Preferences Table (Advanced Learning System)
CREATE TABLE IF NOT EXISTS public.user_learning_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,  -- e.g., 'topic', 'style', 'format', 'subject', 'approach'
    preference_key TEXT NOT NULL,  -- e.g., 'technology', 'formal_writing', 'code_examples'
    preference_value TEXT,  -- optional descriptive value or context
    weight INTEGER NOT NULL CHECK (weight >= -10 AND weight <= 10),
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'chat_summary', 'implicit', 'feedback')),
    confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    last_reinforced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint to prevent duplicates per user
    UNIQUE(user_id, category, preference_key)
);

-- 🚀 PERFORMANCE INDEXES
-- ======================

-- Chat Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON public.chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_is_active ON public.chat_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);

-- Chat Summaries Indexes
CREATE INDEX IF NOT EXISTS idx_chat_summaries_session_id ON public.chat_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_created_at ON public.chat_summaries(created_at DESC);

-- User Preferences Indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Learning Preferences Indexes
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_user_id ON public.user_learning_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_category ON public.user_learning_preferences(category);
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_weight ON public.user_learning_preferences(weight DESC);
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_updated ON public.user_learning_preferences(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_source ON public.user_learning_preferences(source);
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_lookup ON public.user_learning_preferences(user_id, category, preference_key);

-- 🔐 ROW LEVEL SECURITY
-- =====================

-- Enable RLS on all tables
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_learning_preferences ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first
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
DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can view own learning preferences" ON public.user_learning_preferences;
DROP POLICY IF EXISTS "Users can insert own learning preferences" ON public.user_learning_preferences;
DROP POLICY IF EXISTS "Users can update own learning preferences" ON public.user_learning_preferences;
DROP POLICY IF EXISTS "Users can delete own learning preferences" ON public.user_learning_preferences;

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

CREATE POLICY "Users can delete own preferences" ON public.user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for user_learning_preferences
CREATE POLICY "Users can view own learning preferences" ON public.user_learning_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning preferences" ON public.user_learning_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning preferences" ON public.user_learning_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning preferences" ON public.user_learning_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- 🧠 LEARNING PREFERENCES FUNCTIONS
-- =================================

-- Function to limit preferences per user (max 1000)
CREATE OR REPLACE FUNCTION check_user_preference_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.user_learning_preferences WHERE user_id = NEW.user_id) >= 1000 THEN
        RAISE EXCEPTION 'User cannot have more than 1000 learning preferences';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get user preferences summary
CREATE OR REPLACE FUNCTION get_user_learning_summary(target_user_id UUID)
RETURNS TABLE (
    total_preferences INTEGER,
    strong_likes INTEGER,
    strong_dislikes INTEGER,
    categories TEXT[],
    recent_changes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_preferences,
        COUNT(CASE WHEN weight >= 7 THEN 1 END)::INTEGER as strong_likes,
        COUNT(CASE WHEN weight <= -7 THEN 1 END)::INTEGER as strong_dislikes,
        ARRAY_AGG(DISTINCT category) as categories,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '7 days' THEN 1 END)::INTEGER as recent_changes
    FROM public.user_learning_preferences 
    WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upsert preferences (insert or update)
CREATE OR REPLACE FUNCTION upsert_learning_preference(
    target_user_id UUID,
    pref_category TEXT,
    pref_key TEXT,
    pref_value TEXT DEFAULT NULL,
    pref_weight INTEGER DEFAULT 0,
    pref_source TEXT DEFAULT 'manual'
)
RETURNS UUID AS $$
DECLARE
    result_id UUID;
BEGIN
    INSERT INTO public.user_learning_preferences 
        (user_id, category, preference_key, preference_value, weight, source, last_reinforced_at)
    VALUES 
        (target_user_id, pref_category, pref_key, pref_value, pref_weight, pref_source, NOW())
    ON CONFLICT (user_id, category, preference_key) 
    DO UPDATE SET
        preference_value = EXCLUDED.preference_value,
        weight = EXCLUDED.weight,
        source = EXCLUDED.source,
        last_reinforced_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO result_id;
    
    RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 🔧 TRIGGERS
-- ===========

-- Trigger to enforce preference limit
DROP TRIGGER IF EXISTS limit_user_preferences ON public.user_learning_preferences;
CREATE TRIGGER limit_user_preferences
    BEFORE INSERT ON public.user_learning_preferences
    FOR EACH ROW
    EXECUTE FUNCTION check_user_preference_limit();

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON public.chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON public.user_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_learning_preferences_updated_at ON public.user_learning_preferences;
CREATE TRIGGER update_user_learning_preferences_updated_at 
    BEFORE UPDATE ON public.user_learning_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 🔑 PERMISSIONS
-- ==============

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.chat_sessions TO authenticated;
GRANT ALL ON public.chat_summaries TO authenticated;
GRANT ALL ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_learning_preferences TO authenticated;

-- 📝 DATA MIGRATION & UPDATES
-- ===========================

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

-- 📚 DOCUMENTATION
-- ================

-- Add helpful comments
COMMENT ON TABLE public.chat_sessions IS 'Stores chat conversations with messages, model info, and user association';
COMMENT ON TABLE public.chat_summaries IS 'Stores AI-generated summaries and analysis of completed chat sessions';
COMMENT ON TABLE public.user_preferences IS 'Stores user preferences including starred models, primary model, theme, and writing style';
COMMENT ON TABLE public.user_learning_preferences IS 'Stores individual user learning preferences with weights from -10 (strong dislike) to +10 (strong like)';

COMMENT ON COLUMN public.chat_sessions.user_id IS 'User who owns this chat session - required for RLS policies';
COMMENT ON COLUMN public.user_preferences.preferences IS 'User preferences stored as JSONB including starredModels, primaryModel, theme, responseTone, storageEnabled, explicitPreferences, and writingStyle';
COMMENT ON COLUMN public.user_learning_preferences.category IS 'Preference category: topic, style, format, subject, approach, etc.';
COMMENT ON COLUMN public.user_learning_preferences.preference_key IS 'Specific preference identifier within the category';
COMMENT ON COLUMN public.user_learning_preferences.preference_value IS 'Optional descriptive value or context for the preference';
COMMENT ON COLUMN public.user_learning_preferences.weight IS 'Preference weight: -10 (strong dislike) to +10 (strong like)';
COMMENT ON COLUMN public.user_learning_preferences.source IS 'How the preference was learned: manual, chat_summary, implicit, feedback';
COMMENT ON COLUMN public.user_learning_preferences.confidence IS 'Confidence level in this preference (0.0 to 1.0)';
COMMENT ON COLUMN public.user_learning_preferences.last_reinforced_at IS 'When this preference was last reinforced or observed';

-- 🎉 MIGRATION COMPLETE
-- =====================

-- Verification queries (uncomment to check results)
-- SELECT 'chat_sessions' as table_name, COUNT(*) as row_count FROM public.chat_sessions
-- UNION ALL
-- SELECT 'chat_summaries', COUNT(*) FROM public.chat_summaries
-- UNION ALL  
-- SELECT 'user_preferences', COUNT(*) FROM public.user_preferences
-- UNION ALL
-- SELECT 'user_learning_preferences', COUNT(*) FROM public.user_learning_preferences;

-- SELECT 
--     user_id,
--     preferences->'primaryModel' as primary_model,
--     preferences->'starredModels' as starred_models
-- FROM public.user_preferences
-- LIMIT 5;