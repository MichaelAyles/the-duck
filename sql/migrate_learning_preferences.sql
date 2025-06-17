-- Migration: Convert user_learning_preferences from individual rows to JSON structure
-- This migration improves performance from O(n) to O(1) for preference operations

-- Step 1: Create new optimized table structure
CREATE TABLE IF NOT EXISTS user_learning_preferences_v2 (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_user_learning_preferences_v2_user_id ON user_learning_preferences_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_preferences_v2_preferences ON user_learning_preferences_v2 USING GIN(preferences);

-- Step 3: Enable Row Level Security
ALTER TABLE user_learning_preferences_v2 ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies
CREATE POLICY "Users can view their own learning preferences v2" ON user_learning_preferences_v2
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning preferences v2" ON user_learning_preferences_v2
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning preferences v2" ON user_learning_preferences_v2
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning preferences v2" ON user_learning_preferences_v2
    FOR DELETE USING (auth.uid() = user_id);

-- Step 5: Migration function to convert existing data (if old table exists)
CREATE OR REPLACE FUNCTION migrate_learning_preferences_to_v2()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    user_preferences JSONB := '{}';
    pref_record RECORD;
BEGIN
    -- Check if old table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_learning_preferences') THEN
        RAISE NOTICE 'Old user_learning_preferences table does not exist, skipping migration';
        RETURN;
    END IF;

    -- Migrate data for each user
    FOR user_record IN 
        SELECT DISTINCT user_id FROM user_learning_preferences
    LOOP
        -- Initialize empty preferences object
        user_preferences := '{}';
        
        -- Aggregate all preferences for this user into JSON structure
        FOR pref_record IN
            SELECT category, preference_key, preference_value, weight, source, confidence, 
                   last_reinforced_at, created_at, updated_at
            FROM user_learning_preferences 
            WHERE user_id = user_record.user_id
        LOOP
            -- Create category if it doesn't exist
            IF NOT (user_preferences ? pref_record.category) THEN
                user_preferences := jsonb_set(user_preferences, ARRAY[pref_record.category], '{}');
            END IF;
            
            -- Add preference to category
            user_preferences := jsonb_set(
                user_preferences, 
                ARRAY[pref_record.category, pref_record.preference_key], 
                jsonb_build_object(
                    'value', pref_record.preference_value,
                    'weight', pref_record.weight,
                    'source', pref_record.source,
                    'confidence', pref_record.confidence,
                    'last_reinforced_at', pref_record.last_reinforced_at,
                    'created_at', pref_record.created_at,
                    'updated_at', pref_record.updated_at
                )
            );
        END LOOP;
        
        -- Insert aggregated preferences for this user
        INSERT INTO user_learning_preferences_v2 (user_id, preferences, created_at, updated_at)
        VALUES (
            user_record.user_id, 
            user_preferences,
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            preferences = EXCLUDED.preferences,
            updated_at = NOW();
            
        RAISE NOTICE 'Migrated preferences for user %', user_record.user_id;
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Step 6: Optimized upsert function for JSON structure
CREATE OR REPLACE FUNCTION upsert_learning_preference_v2(
    target_user_id UUID,
    pref_category TEXT,
    pref_key TEXT,
    pref_value TEXT DEFAULT NULL,
    pref_weight INTEGER DEFAULT 0,
    pref_source TEXT DEFAULT 'manual',
    pref_confidence REAL DEFAULT 1.0
) RETURNS TEXT AS $$
DECLARE
    current_preferences JSONB;
    updated_preferences JSONB;
    preference_data JSONB;
BEGIN
    -- Validate inputs
    IF pref_weight < -10 OR pref_weight > 10 THEN
        RAISE EXCEPTION 'Weight must be between -10 and 10';
    END IF;
    
    IF pref_source NOT IN ('manual', 'chat_summary', 'implicit', 'feedback') THEN
        RAISE EXCEPTION 'Invalid source: %', pref_source;
    END IF;
    
    -- Get current preferences or initialize empty object
    SELECT COALESCE(preferences, '{}') INTO current_preferences
    FROM user_learning_preferences_v2 
    WHERE user_id = target_user_id;
    
    IF current_preferences IS NULL THEN
        current_preferences := '{}';
    END IF;
    
    -- Create category if it doesn't exist
    IF NOT (current_preferences ? pref_category) THEN
        current_preferences := jsonb_set(current_preferences, ARRAY[pref_category], '{}');
    END IF;
    
    -- Create preference data object
    preference_data := jsonb_build_object(
        'value', pref_value,
        'weight', pref_weight,
        'source', pref_source,
        'confidence', pref_confidence,
        'last_reinforced_at', NOW(),
        'updated_at', NOW()
    );
    
    -- Add created_at if this is a new preference
    IF NOT (current_preferences #> ARRAY[pref_category] ? pref_key) THEN
        preference_data := preference_data || jsonb_build_object('created_at', NOW());
    ELSE
        -- Keep existing created_at
        preference_data := preference_data || jsonb_build_object(
            'created_at', 
            current_preferences #> ARRAY[pref_category, pref_key, 'created_at']
        );
    END IF;
    
    -- Update the preference
    updated_preferences := jsonb_set(
        current_preferences, 
        ARRAY[pref_category, pref_key], 
        preference_data
    );
    
    -- Upsert the user's preferences
    INSERT INTO user_learning_preferences_v2 (user_id, preferences, created_at, updated_at)
    VALUES (target_user_id, updated_preferences, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        preferences = EXCLUDED.preferences,
        updated_at = NOW();
    
    RETURN pref_category || '.' || pref_key;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Function to get user learning summary from JSON structure
CREATE OR REPLACE FUNCTION get_user_learning_summary_v2(target_user_id UUID)
RETURNS TABLE(
    total_preferences INTEGER,
    strong_likes INTEGER,
    strong_dislikes INTEGER,
    categories TEXT[],
    recent_changes INTEGER
) AS $$
DECLARE
    user_prefs JSONB;
    category_key TEXT;
    pref_key TEXT;
    pref_data JSONB;
    weight INTEGER;
    updated_at TIMESTAMP;
BEGIN
    -- Get user preferences
    SELECT preferences INTO user_prefs
    FROM user_learning_preferences_v2 
    WHERE user_id = target_user_id;
    
    -- Initialize counters
    total_preferences := 0;
    strong_likes := 0;
    strong_dislikes := 0;
    categories := ARRAY[]::TEXT[];
    recent_changes := 0;
    
    -- If no preferences found, return zeros
    IF user_prefs IS NULL THEN
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Iterate through categories
    FOR category_key IN SELECT jsonb_object_keys(user_prefs)
    LOOP
        -- Add category to list if not already present
        IF NOT (category_key = ANY(categories)) THEN
            categories := array_append(categories, category_key);
        END IF;
        
        -- Iterate through preferences in this category
        FOR pref_key IN SELECT jsonb_object_keys(user_prefs -> category_key)
        LOOP
            pref_data := user_prefs -> category_key -> pref_key;
            
            -- Count total preferences
            total_preferences := total_preferences + 1;
            
            -- Get weight and count strong preferences
            weight := (pref_data ->> 'weight')::INTEGER;
            IF weight >= 7 THEN
                strong_likes := strong_likes + 1;
            ELSIF weight <= -7 THEN
                strong_dislikes := strong_dislikes + 1;
            END IF;
            
            -- Count recent changes (within last 7 days)
            updated_at := (pref_data ->> 'updated_at')::TIMESTAMP;
            IF updated_at > NOW() - INTERVAL '7 days' THEN
                recent_changes := recent_changes + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Function to delete specific preference
CREATE OR REPLACE FUNCTION delete_learning_preference_v2(
    target_user_id UUID,
    pref_category TEXT,
    pref_key TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    current_preferences JSONB;
    updated_preferences JSONB;
BEGIN
    -- Get current preferences
    SELECT preferences INTO current_preferences
    FROM user_learning_preferences_v2 
    WHERE user_id = target_user_id;
    
    IF current_preferences IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if preference exists
    IF NOT (current_preferences #> ARRAY[pref_category] ? pref_key) THEN
        RETURN FALSE;
    END IF;
    
    -- Remove the preference
    updated_preferences := current_preferences #- ARRAY[pref_category, pref_key];
    
    -- If category is now empty, remove it
    IF jsonb_object_keys(updated_preferences -> pref_category) IS NULL THEN
        updated_preferences := updated_preferences - pref_category;
    END IF;
    
    -- Update the record
    UPDATE user_learning_preferences_v2 
    SET preferences = updated_preferences, updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Function to clear all preferences for a user
CREATE OR REPLACE FUNCTION clear_learning_preferences_v2(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM user_learning_preferences_v2 WHERE user_id = target_user_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Add trigger for automatic updated_at
CREATE TRIGGER update_user_learning_preferences_v2_updated_at 
    BEFORE UPDATE ON user_learning_preferences_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Instructions for deployment:
-- 1. Run this migration script in Supabase SQL Editor
-- 2. Execute: SELECT migrate_learning_preferences_to_v2(); 
-- 3. Verify data migration was successful
-- 4. Update API code to use v2 functions and table
-- 5. After successful deployment, optionally drop old table:
--    DROP TABLE IF EXISTS user_learning_preferences CASCADE;