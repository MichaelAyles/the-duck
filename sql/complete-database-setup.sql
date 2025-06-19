-- =====================================================
-- THE DUCK - COMPLETE DATABASE SETUP
-- =====================================================
-- This file contains the complete database schema and migrations for The Duck
-- Run this in Supabase SQL Editor for initial setup or to update existing database
-- 
-- Sections:
-- 1. Extensions & Prerequisites
-- 2. Core Tables & Schema
-- 3. File Upload System
-- 4. Performance Indexes
-- 5. Security & RLS Policies
-- 6. Functions & Procedures
-- 7. Data Migration & Cleanup
-- 8. Verification & Testing

-- =====================================================
-- 1. EXTENSIONS & PREREQUISITES
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 2. CORE TABLES & SCHEMA
-- =====================================================

-- Clean up duplicate data first (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_summaries') THEN
        -- Remove duplicate chat_summaries (keep the most recent one for each session_id)
        DELETE FROM chat_summaries 
        WHERE id NOT IN (
            SELECT DISTINCT ON (session_id) id
            FROM chat_summaries
            ORDER BY session_id, created_at DESC
        );
        RAISE NOTICE '🧹 Cleaned up duplicate chat_summaries';
    END IF;
END $$;

-- Fix user_preferences table structure (add missing columns)
DO $$ 
BEGIN
    -- Add starred_models column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_preferences' AND column_name = 'starred_models' AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_preferences ADD COLUMN starred_models TEXT[] DEFAULT '{}';
        RAISE NOTICE '✅ Added starred_models column to user_preferences';
    END IF;

    -- Add theme column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_preferences' AND column_name = 'theme' AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_preferences ADD COLUMN theme TEXT DEFAULT 'system';
        RAISE NOTICE '✅ Added theme column to user_preferences';
    END IF;

    -- Add default_model column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_preferences' AND column_name = 'default_model' AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_preferences ADD COLUMN default_model TEXT DEFAULT 'claude-3-haiku-20240307';
        RAISE NOTICE '✅ Added default_model column to user_preferences';
    END IF;

    -- Add id column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_preferences' AND column_name = 'id' AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_preferences ADD COLUMN id UUID DEFAULT uuid_generate_v4();
        RAISE NOTICE '✅ Added id column to user_preferences';
    END IF;

    -- Add created_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_preferences' AND column_name = 'created_at' AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_preferences ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());
        RAISE NOTICE '✅ Added created_at column to user_preferences';
    END IF;
END $$;

-- Create missing core tables
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
-- 3. FILE UPLOAD SYSTEM
-- =====================================================

-- Drop existing file_uploads table if it exists (to fix foreign key issues)
DROP TABLE IF EXISTS file_uploads CASCADE;

-- Create file_uploads table with proper constraints
CREATE TABLE file_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
  message_id TEXT, -- Will reference specific message once uploaded
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT file_size_limit CHECK (file_size <= 10485760), -- 10MB limit
  CONSTRAINT valid_mime_type CHECK (
    mime_type IN (
      -- Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      -- Documents
      'application/pdf', 
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      -- Text
      'text/plain', 'text/csv', 'text/markdown',
      -- Code
      'text/javascript', 'application/json', 'text/html', 'text/css', 'text/typescript',
      'application/x-python-code', 'application/x-ruby', 'application/x-sh',
      -- DuckPond Artifacts
      'text/x-react-component', 'text/x-duckpond-artifact',
      -- Archives
      'application/zip', 'application/x-tar', 'application/x-gzip'
    )
  )
);

-- Create storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, allowed_mime_types, file_size_limit)
VALUES (
  'chat-uploads',
  'chat-uploads', 
  false, -- Private bucket
  false,
  ARRAY[
    -- Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    -- Documents
    'application/pdf', 
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    -- Text
    'text/plain', 'text/csv', 'text/markdown',
    -- Code
    'text/javascript', 'application/json', 'text/html', 'text/css', 'text/typescript',
    'application/x-python-code', 'application/x-ruby', 'application/x-sh',
    -- DuckPond Artifacts
    'text/x-react-component', 'text/x-duckpond-artifact',
    -- Archives
    'application/zip', 'application/x-tar', 'application/x-gzip'
  ],
  10485760 -- 10MB limit
)
ON CONFLICT (id) DO UPDATE
SET 
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

-- =====================================================
-- 4. PERFORMANCE INDEXES
-- =====================================================

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_timestamp ON user_usage(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_timestamp ON user_usage(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_learning_preferences_v2_user_id ON user_learning_preferences_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_preferences_v2_preferences ON user_learning_preferences_v2 USING GIN (preferences);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_session_id ON chat_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_created_at ON chat_summaries(created_at);

-- File upload indexes
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_session ON file_uploads(user_id, session_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_file_uploads_message ON file_uploads(message_id) WHERE message_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_file_uploads_created ON file_uploads(created_at DESC);

-- Performance optimization indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_endpoint ON user_usage(user_id, endpoint);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_created ON chat_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_timestamp_range ON user_usage(user_id, timestamp) WHERE timestamp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_summaries_user_via_session ON chat_summaries(session_id) INCLUDE (created_at, summary);

-- =====================================================
-- 5. SECURITY & RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_preferences_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

    -- file_uploads policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'file_uploads' AND policyname = 'Users can view own files') THEN
        EXECUTE 'CREATE POLICY "Users can view own files" ON file_uploads FOR SELECT USING (auth.uid() = user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'file_uploads' AND policyname = 'Users can upload files') THEN
        EXECUTE 'CREATE POLICY "Users can upload files" ON file_uploads FOR INSERT WITH CHECK (auth.uid() = user_id AND deleted_at IS NULL)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'file_uploads' AND policyname = 'Users can soft delete own files') THEN
        EXECUTE 'CREATE POLICY "Users can soft delete own files" ON file_uploads FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- Storage bucket policies
DO $$
BEGIN
    -- Drop existing policies if they exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload') THEN
        DROP POLICY "Authenticated users can upload" ON storage.objects;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can download own files') THEN
        DROP POLICY "Users can download own files" ON storage.objects;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own files') THEN
        DROP POLICY "Users can delete own files" ON storage.objects;
    END IF;
END $$;

-- Create storage policies
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can download own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- =====================================================
-- 6. FUNCTIONS & PROCEDURES
-- =====================================================

-- Learning preferences functions
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

-- File storage usage function
CREATE OR REPLACE FUNCTION get_user_storage_usage(user_uuid UUID)
RETURNS TABLE (
  total_size BIGINT,
  file_count INTEGER,
  deleted_size BIGINT,
  deleted_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN deleted_at IS NULL THEN file_size ELSE 0 END), 0)::BIGINT as total_size,
    COUNT(CASE WHEN deleted_at IS NULL THEN 1 END)::INTEGER as file_count,
    COALESCE(SUM(CASE WHEN deleted_at IS NOT NULL THEN file_size ELSE 0 END), 0)::BIGINT as deleted_size,
    COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END)::INTEGER as deleted_count
  FROM file_uploads
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- File cleanup function
CREATE OR REPLACE FUNCTION cleanup_deleted_files()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete file records that have been soft-deleted for more than 30 days
  DELETE FROM file_uploads
  WHERE deleted_at IS NOT NULL 
  AND deleted_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON user_credits;
CREATE TRIGGER update_user_credits_updated_at
    BEFORE UPDATE ON user_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. DATA MIGRATION & CLEANUP
-- =====================================================

-- Add missing unique constraint for chat_summaries
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_session_id' AND conrelid = 'chat_summaries'::regclass
    ) THEN
        ALTER TABLE chat_summaries ADD CONSTRAINT unique_session_id UNIQUE (session_id);
        RAISE NOTICE '✅ Added unique_session_id constraint to chat_summaries';
    ELSE
        RAISE NOTICE '✅ unique_session_id constraint already exists';
    END IF;
END $$;

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
        
        RAISE NOTICE '✅ Migration from user_learning_preferences completed';
    END IF;
END $$;

-- =====================================================
-- 8. VERIFICATION & TESTING
-- =====================================================

-- Test 1: Verify all required tables exist
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    current_table TEXT;
    tables_to_check TEXT[] := ARRAY[
        'chat_sessions', 'chat_summaries', 'user_preferences', 
        'user_credits', 'user_usage', 'user_learning_preferences_v2', 
        'file_uploads'
    ];
BEGIN
    FOREACH current_table IN ARRAY tables_to_check
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = current_table
        ) THEN
            missing_tables := array_append(missing_tables, current_table);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION '❌ Missing tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✅ All required tables exist';
    END IF;
END $$;

-- Test 2: Verify file_uploads foreign key allows NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'file_uploads' 
        AND column_name = 'session_id' 
        AND is_nullable = 'YES'
    ) THEN
        RAISE NOTICE '✅ file_uploads.session_id correctly allows NULL';
    ELSE
        RAISE EXCEPTION '❌ file_uploads.session_id should allow NULL values';
    END IF;
END $$;

-- Test 3: Verify storage bucket exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-uploads') THEN
        RAISE NOTICE '✅ Storage bucket "chat-uploads" exists';
    ELSE
        RAISE EXCEPTION '❌ Storage bucket "chat-uploads" is missing';
    END IF;
END $$;

-- Test 4: Test file upload functionality (mock test)
DO $$
DECLARE
    test_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- Mock user ID
BEGIN
    -- This test would normally require a real user, so we'll just verify the schema
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'file_uploads' 
        AND column_name = 'user_id'
    ) THEN
        RAISE NOTICE '✅ file_uploads schema is correct for user association';
    END IF;
END $$;

-- Test 5: Verify RLS policies exist
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename IN ('user_preferences', 'user_credits', 'user_usage', 'user_learning_preferences_v2', 'file_uploads');
    
    IF policy_count >= 15 THEN
        RAISE NOTICE '✅ RLS policies are properly configured (% policies found)', policy_count;
    ELSE
        RAISE WARNING '⚠️ Expected at least 15 RLS policies, found %', policy_count;
    END IF;
END $$;

-- Test 6: Verify performance indexes
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE tablename IN ('chat_sessions', 'user_usage', 'file_uploads', 'user_preferences', 'chat_summaries')
    AND indexname LIKE 'idx_%';
    
    IF index_count >= 10 THEN
        RAISE NOTICE '✅ Performance indexes are created (% indexes found)', index_count;
    ELSE
        RAISE WARNING '⚠️ Expected at least 10 performance indexes, found %', index_count;
    END IF;
END $$;

-- =====================================================
-- VERIFICATION SUMMARY
-- =====================================================

-- Show table status
SELECT 
    '📋 TABLE STATUS' as section,
    required_tables.table_name,
    CASE WHEN ist.table_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
    COALESCE(pgc.reltuples::INTEGER, 0) as estimated_rows
FROM (VALUES 
    ('chat_sessions'),
    ('chat_summaries'), 
    ('user_preferences'),
    ('user_credits'),
    ('user_usage'),
    ('user_learning_preferences_v2'),
    ('file_uploads')
) AS required_tables(table_name)
LEFT JOIN information_schema.tables ist 
    ON ist.table_name = required_tables.table_name AND ist.table_schema = 'public'
LEFT JOIN pg_class pgc 
    ON pgc.relname = required_tables.table_name
ORDER BY required_tables.table_name;

-- Show file_uploads configuration
SELECT 
    '📁 FILE UPLOAD CONFIG' as section,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'file_uploads' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show storage bucket configuration
SELECT 
    '💾 STORAGE BUCKET' as section,
    id as bucket_name,
    public as is_public,
    file_size_limit,
    array_length(allowed_mime_types, 1) as allowed_types_count
FROM storage.buckets 
WHERE id = 'chat-uploads';

-- Show index summary
SELECT 
    '⚡ PERFORMANCE INDEXES' as section,
    schemaname,
    tablename,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename IN ('chat_sessions', 'user_usage', 'file_uploads', 'user_preferences', 'chat_summaries', 'user_credits', 'user_learning_preferences_v2')
AND indexname LIKE 'idx_%'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Show RLS policy summary
SELECT 
    '🔒 SECURITY POLICIES' as section,
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN ('user_preferences', 'user_credits', 'user_usage', 'user_learning_preferences_v2', 'file_uploads')
OR (schemaname = 'storage' AND tablename = 'objects')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

-- Final success message
SELECT 
    '🎉 DATABASE SETUP COMPLETE!' as result,
    'The Duck database is ready for file uploads and all features.' as message,
    NOW() as completed_at;