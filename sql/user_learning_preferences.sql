-- 🧠 User Learning Preferences Schema
-- Advanced learning system with weighted preferences (-10 to +10 scale)

-- Create user_learning_preferences table
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

-- Create function to limit preferences per user (max 1000)
CREATE OR REPLACE FUNCTION check_user_preference_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.user_learning_preferences WHERE user_id = NEW.user_id) >= 1000 THEN
        RAISE EXCEPTION 'User cannot have more than 1000 learning preferences';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce preference limit
DROP TRIGGER IF EXISTS limit_user_preferences ON public.user_learning_preferences;
CREATE TRIGGER limit_user_preferences
    BEFORE INSERT ON public.user_learning_preferences
    FOR EACH ROW
    EXECUTE FUNCTION check_user_preference_limit();

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_user_id ON public.user_learning_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_category ON public.user_learning_preferences(category);
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_weight ON public.user_learning_preferences(weight DESC);
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_updated ON public.user_learning_preferences(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_source ON public.user_learning_preferences(source);

-- Create composite index for fast preference lookups
CREATE INDEX IF NOT EXISTS idx_user_learning_prefs_lookup ON public.user_learning_preferences(user_id, category, preference_key);

-- Enable Row Level Security
ALTER TABLE public.user_learning_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own learning preferences" ON public.user_learning_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning preferences" ON public.user_learning_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning preferences" ON public.user_learning_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning preferences" ON public.user_learning_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at timestamp
DROP TRIGGER IF EXISTS update_user_learning_preferences_updated_at ON public.user_learning_preferences;
CREATE TRIGGER update_user_learning_preferences_updated_at 
    BEFORE UPDATE ON public.user_learning_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.user_learning_preferences TO authenticated;

-- Add helpful comments
COMMENT ON TABLE public.user_learning_preferences IS 'Stores individual user learning preferences with weights from -10 (strong dislike) to +10 (strong like)';
COMMENT ON COLUMN public.user_learning_preferences.category IS 'Preference category: topic, style, format, subject, approach, etc.';
COMMENT ON COLUMN public.user_learning_preferences.preference_key IS 'Specific preference identifier within the category';
COMMENT ON COLUMN public.user_learning_preferences.preference_value IS 'Optional descriptive value or context for the preference';
COMMENT ON COLUMN public.user_learning_preferences.weight IS 'Preference weight: -10 (strong dislike) to +10 (strong like)';
COMMENT ON COLUMN public.user_learning_preferences.source IS 'How the preference was learned: manual, chat_summary, implicit, feedback';
COMMENT ON COLUMN public.user_learning_preferences.confidence IS 'Confidence level in this preference (0.0 to 1.0)';
COMMENT ON COLUMN public.user_learning_preferences.last_reinforced_at IS 'When this preference was last reinforced or observed';

-- Create function to get user preferences summary
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

-- Create function to upsert preferences (insert or update)
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