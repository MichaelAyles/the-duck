-- Final Database Migration - Handles Duplicates and Schema Updates
-- This file fixes duplicate data and aligns schema with code requirements

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CLEAN UP DUPLICATE DATA
-- =====================================================

-- Remove duplicate chat_summaries (keep the most recent one for each session_id)
DELETE FROM chat_summaries 
WHERE id NOT IN (
    SELECT DISTINCT ON (session_id) id
    FROM chat_summaries
    ORDER BY session_id, created_at DESC
);

-- =====================================================
-- TABLE STRUCTURE FIXES
-- =====================================================

-- Fix user_preferences table structure
DO $$ 
BEGIN
    -- Add starred_models column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_preferences' AND column_name = 'starred_models' AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_preferences ADD COLUMN starred_models TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Added starred_models column to user_preferences';
    END IF;

    -- Add theme column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_preferences' AND column_name = 'theme' AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_preferences ADD COLUMN theme TEXT DEFAULT 'system';
        RAISE NOTICE 'Added theme column to user_preferences';
    END IF;

    -- Add default_model column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_preferences' AND column_name = 'default_model' AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_preferences ADD COLUMN default_model TEXT DEFAULT 'claude-3-haiku-20240307';
        RAISE NOTICE 'Added default_model column to user_preferences';
    END IF;

    -- Add id column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_preferences' AND column_name = 'id' AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_preferences ADD COLUMN id UUID DEFAULT uuid_generate_v4();
        RAISE NOTICE 'Added id column to user_preferences';
    END IF;

    -- Add created_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_preferences' AND column_name = 'created_at' AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_preferences ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());
        RAISE NOTICE 'Added created_at column to user_preferences';
    END IF;
END $$;

-- Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_credits INTEGER NOT NULL DEFAULT 10000,
    used_credits INTEGER NOT NULL DEFAULT 0,
    credit_limit_period TEXT NOT NULL DEFAULT 'daily' CHECK (credit_limit_period IN ('daily', 'weekly', 'monthly')),
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT unique_user_credits UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS user_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    model TEXT,
    token_count INTEGER NOT NULL DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS user_learning_preferences_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT unique_user_learning_preferences_v2 UNIQUE (user_id)
);

-- =====================================================
-- CONSTRAINT FIXES
-- =====================================================

-- Add missing unique constraint for chat_summaries (now that duplicates are removed)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_session_id' AND conrelid = 'chat_summaries'::regclass
    ) THEN
        ALTER TABLE chat_summaries ADD CONSTRAINT unique_session_id UNIQUE (session_id);
        RAISE NOTICE 'Added unique_session_id constraint to chat_summaries';
    ELSE
        RAISE NOTICE 'unique_session_id constraint already exists';
    END IF;
END $$;

-- =====================================================
-- INDEXES
-- =====================================================

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_timestamp ON user_usage(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_timestamp ON user_usage(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_learning_preferences_v2_user_id ON user_learning_preferences_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_preferences_v2_preferences ON user_learning_preferences_v2 USING GIN (preferences);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_session_id ON chat_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_created_at ON chat_summaries(created_at);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on tables
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_preferences_v2 ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (with IF NOT EXISTS equivalent using DO blocks)
DO $$ 
BEGIN
    -- user_preferences policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can view their own preferences') THEN
        EXECUTE 'CREATE POLICY "Users can view their own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can insert their own preferences') THEN
        EXECUTE 'CREATE POLICY "Users can insert their own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can update their own preferences') THEN
        EXECUTE 'CREATE POLICY "Users can update their own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id)';
    END IF;

    -- user_credits policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Users can view their own credits') THEN
        EXECUTE 'CREATE POLICY "Users can view their own credits" ON user_credits FOR SELECT USING (auth.uid() = user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Users can insert their own credits') THEN
        EXECUTE 'CREATE POLICY "Users can insert their own credits" ON user_credits FOR INSERT WITH CHECK (auth.uid() = user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Users can update their own credits') THEN
        EXECUTE 'CREATE POLICY "Users can update their own credits" ON user_credits FOR UPDATE USING (auth.uid() = user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Service role can manage all credits') THEN
        EXECUTE 'CREATE POLICY "Service role can manage all credits" ON user_credits FOR ALL USING (auth.jwt() ->> ''role'' = ''service_role'')';
    END IF;

    -- user_usage policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_usage' AND policyname = 'Users can view their own usage') THEN
        EXECUTE 'CREATE POLICY "Users can view their own usage" ON user_usage FOR SELECT USING (auth.uid() = user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_usage' AND policyname = 'Users can insert their own usage') THEN
        EXECUTE 'CREATE POLICY "Users can insert their own usage" ON user_usage FOR INSERT WITH CHECK (auth.uid() = user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_usage' AND policyname = 'Service role can manage all usage') THEN
        EXECUTE 'CREATE POLICY "Service role can manage all usage" ON user_usage FOR ALL USING (auth.jwt() ->> ''role'' = ''service_role'')';
    END IF;

    -- user_learning_preferences_v2 policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_learning_preferences_v2' AND policyname = 'Users can view their own learning preferences v2') THEN
        EXECUTE 'CREATE POLICY "Users can view their own learning preferences v2" ON user_learning_preferences_v2 FOR SELECT USING (auth.uid() = user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_learning_preferences_v2' AND policyname = 'Users can insert their own learning preferences v2') THEN
        EXECUTE 'CREATE POLICY "Users can insert their own learning preferences v2" ON user_learning_preferences_v2 FOR INSERT WITH CHECK (auth.uid() = user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_learning_preferences_v2' AND policyname = 'Users can update their own learning preferences v2') THEN
        EXECUTE 'CREATE POLICY "Users can update their own learning preferences v2" ON user_learning_preferences_v2 FOR UPDATE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Create or replace the upsert function for learning preferences
CREATE OR REPLACE FUNCTION upsert_learning_preference(
    target_user_id UUID,
    pref_category TEXT,
    pref_key TEXT,
    pref_value TEXT DEFAULT NULL,
    pref_weight INTEGER DEFAULT 0
)
RETURNS void AS $$
DECLARE
    full_key TEXT;
    current_weight INTEGER;
    new_weight INTEGER;
BEGIN
    -- Create the full key (e.g., "topic/AI and machine learning")
    full_key := pref_category || '/' || pref_key;
    
    -- Ensure user has a preferences record
    INSERT INTO user_learning_preferences_v2 (user_id, preferences)
    VALUES (target_user_id, '{}'::jsonb)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Get current weight if it exists
    SELECT (preferences->full_key->>'weight')::INTEGER
    INTO current_weight
    FROM user_learning_preferences_v2
    WHERE user_id = target_user_id;
    
    -- Calculate new weight (accumulate with existing)
    new_weight := COALESCE(current_weight, 0) + pref_weight;
    
    -- Update the preferences JSONB
    UPDATE user_learning_preferences_v2
    SET preferences = jsonb_set(
        preferences,
        ARRAY[full_key],
        jsonb_build_object(
            'value', COALESCE(pref_value, ''),
            'weight', new_weight,
            'lastUpdated', NOW()
        ),
        true
    ),
    updated_at = NOW()
    WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get learning preferences
CREATE OR REPLACE FUNCTION get_learning_preferences(target_user_id UUID)
RETURNS TABLE (
    category TEXT,
    preference_key TEXT,
    preference_value TEXT,
    weight INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        split_part(key, '/', 1) as category,
        split_part(key, '/', 2) as preference_key,
        value->>'value' as preference_value,
        (value->>'weight')::INTEGER as weight,
        (value->>'lastUpdated')::TIMESTAMP WITH TIME ZONE as last_updated
    FROM user_learning_preferences_v2,
         jsonb_each(preferences) as entries(key, value)
    WHERE user_id = target_user_id
    ORDER BY (value->>'weight')::INTEGER DESC;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to user_credits table
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON user_credits;
CREATE TRIGGER update_user_credits_updated_at
    BEFORE UPDATE ON user_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DATA MIGRATION
-- =====================================================

-- Migrate old learning preferences if they exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_learning_preferences'
    ) THEN
        INSERT INTO user_learning_preferences_v2 (user_id, preferences)
        SELECT 
            user_id,
            jsonb_object_agg(
                category || '/' || preference_key,
                jsonb_build_object(
                    'value', preference_value,
                    'weight', weight,
                    'lastUpdated', updated_at
                )
            ) as preferences
        FROM user_learning_preferences
        GROUP BY user_id
        ON CONFLICT (user_id) DO UPDATE
        SET preferences = EXCLUDED.preferences,
            updated_at = NOW();
        
        RAISE NOTICE 'Migration from user_learning_preferences completed';
    END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Show what was cleaned up
SELECT 
    '🧹 Chat summaries cleanup:' as info,
    COUNT(*) as remaining_summaries,
    COUNT(DISTINCT session_id) as unique_sessions
FROM chat_summaries;

-- Verify user_preferences columns
SELECT 
    '👤 user_preferences columns:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'user_preferences' AND table_schema = 'public'
ORDER BY column_name;

-- Verify chat_summaries constraint
SELECT 
    '🔒 chat_summaries constraints:' as info,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'chat_summaries' AND table_schema = 'public'
AND constraint_type = 'UNIQUE';

-- Verify all required tables exist
SELECT 
    '📋 Table status:' as info,
    required_tables.table_name,
    CASE WHEN ist.table_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM (VALUES 
    ('chat_sessions'),
    ('chat_summaries'), 
    ('user_preferences'),
    ('user_credits'),
    ('user_usage'),
    ('user_learning_preferences_v2')
) AS required_tables(table_name)
LEFT JOIN information_schema.tables ist 
    ON ist.table_name = required_tables.table_name AND ist.table_schema = 'public'
ORDER BY required_tables.table_name;

-- Final success message
SELECT '🎉 Database migration completed successfully! Duplicates cleaned up and schema aligned with code.' as result;