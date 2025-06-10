-- 🔧 Migration: Add primaryModel support to user_preferences
-- This updates the JSONB structure to include the primaryModel field

-- First, let's see what we're working with
-- (This is just for information - you can run this first to check current data)
-- SELECT user_id, preferences FROM user_preferences LIMIT 5;

-- Update all existing user preferences to include primaryModel
-- This will set the primaryModel to the first starred model, or default to Gemini Flash
UPDATE user_preferences 
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
UPDATE user_preferences 
SET preferences = preferences || jsonb_build_object(
    'starredModels', 
    '["google/gemini-2.5-flash-preview-05-20", "google/gemini-2.5-pro-preview-05-06", "deepseek/deepseek-chat-v3-0324", "anthropic/claude-sonnet-4", "openai/gpt-4o-mini"]'::jsonb,
    'primaryModel', 
    '"google/gemini-2.5-flash-preview-05-20"'::jsonb
)
WHERE NOT (preferences ? 'starredModels');

-- Update the default JSON for new users to include primaryModel
-- This updates the column default for future inserts
ALTER TABLE user_preferences 
ALTER COLUMN preferences 
SET DEFAULT '{
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
}'::jsonb;

-- Verify the migration worked
-- (Run this to check the results)
SELECT 
    user_id,
    preferences->'primaryModel' as primary_model,
    preferences->'starredModels' as starred_models
FROM user_preferences;

-- Add a comment to document the schema
COMMENT ON COLUMN user_preferences.preferences IS 'User preferences stored as JSONB including starredModels, primaryModel, theme, responseTone, storageEnabled, explicitPreferences, and writingStyle'; 