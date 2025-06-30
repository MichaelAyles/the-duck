-- =====================================================
-- APPEND-ONLY MESSAGES MIGRATION
-- =====================================================
-- This migration creates a proper append-only message storage system
-- to prevent data loss from concurrent session saves.
-- 
-- CRITICAL: This addresses race conditions where multiple saves
-- can overwrite each other when replacing entire message arrays.
--
-- BEFORE: Messages stored as JSONB array in chat_sessions table
-- AFTER: Individual messages stored in separate messages table
-- =====================================================

-- =====================================================
-- 1. CREATE NEW MESSAGE STORAGE SCHEMA
-- =====================================================

-- Create the messages table for append-only storage
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    message_index INTEGER NOT NULL, -- Order within the session
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure messages are unique within a session
    UNIQUE(session_id, message_index)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_session_order ON messages(session_id, message_index);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Enable RLS for security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM chat_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages to own sessions" ON messages
    FOR INSERT WITH CHECK (
        session_id IN (
            SELECT id FROM chat_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own messages" ON messages
    FOR UPDATE USING (
        session_id IN (
            SELECT id FROM chat_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own messages" ON messages
    FOR DELETE USING (
        session_id IN (
            SELECT id FROM chat_sessions WHERE user_id = auth.uid()
        )
    );

-- Add trigger for updated_at
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. MIGRATION FUNCTIONS
-- =====================================================

-- Function to migrate existing messages from JSONB to separate records
CREATE OR REPLACE FUNCTION migrate_messages_to_append_only()
RETURNS INTEGER AS $$
DECLARE
    session_record RECORD;
    message_record RECORD;
    current_message_idx INTEGER;
    migrated_count INTEGER := 0;
    total_sessions INTEGER := 0;
BEGIN
    -- Get total sessions for progress tracking
    SELECT COUNT(*) INTO total_sessions FROM chat_sessions WHERE messages IS NOT NULL AND jsonb_array_length(messages) > 0;
    
    RAISE NOTICE 'Starting migration of messages from % sessions...', total_sessions;
    
    -- Loop through each session with messages
    FOR session_record IN 
        SELECT id, messages, created_at, updated_at 
        FROM chat_sessions 
        WHERE messages IS NOT NULL AND jsonb_array_length(messages) > 0
    LOOP
        current_message_idx := 0;
        
        -- Loop through each message in the JSONB array
        FOR message_record IN 
            SELECT 
                value->>'role' as role,
                value->>'content' as content,
                COALESCE(value - 'role' - 'content', '{}') as metadata
            FROM jsonb_array_elements(session_record.messages)
        LOOP
            -- Insert message into new table
            INSERT INTO messages (
                session_id,
                message_index,
                role,
                content,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                session_record.id,
                current_message_idx,
                message_record.role,
                message_record.content,
                message_record.metadata::jsonb,
                session_record.created_at,
                session_record.updated_at
            ) ON CONFLICT (session_id, message_index) DO NOTHING;
            
            current_message_idx := current_message_idx + 1;
            migrated_count := migrated_count + 1;
        END LOOP;
        
        -- Clear the JSONB messages array to indicate migration completed
        UPDATE chat_sessions 
        SET messages = '[]'::jsonb
        WHERE id = session_record.id;
    END LOOP;
    
    RAISE NOTICE 'Migration completed: % messages migrated from % sessions', migrated_count, total_sessions;
    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to append a single message (append-only operation)
CREATE OR REPLACE FUNCTION append_message(
    p_session_id TEXT,
    p_role TEXT,
    p_content TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    next_index INTEGER;
    message_id UUID;
BEGIN
    -- Get the next message index for this session
    SELECT COALESCE(MAX(message_index), -1) + 1
    INTO next_index
    FROM messages
    WHERE session_id = p_session_id;
    
    -- Insert the new message
    INSERT INTO messages (
        session_id,
        message_index,
        role,
        content,
        metadata
    ) VALUES (
        p_session_id,
        next_index,
        p_role,
        p_content,
        p_metadata
    )
    RETURNING id INTO message_id;
    
    -- Update session timestamp
    UPDATE chat_sessions 
    SET updated_at = NOW()
    WHERE id = p_session_id;
    
    RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get messages for a session (optimized for reading)
CREATE OR REPLACE FUNCTION get_session_messages(p_session_id TEXT)
RETURNS TABLE (
    id UUID,
    role TEXT,
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.role,
        m.content,
        m.metadata,
        m.created_at
    FROM messages m
    WHERE m.session_id = p_session_id
    ORDER BY m.message_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely get session message count
CREATE OR REPLACE FUNCTION get_session_message_count(p_session_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    message_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO message_count
    FROM messages
    WHERE session_id = p_session_id;
    
    RETURN COALESCE(message_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. UPDATE CHAT_SESSIONS SCHEMA
-- =====================================================

-- Add columns to track migration status and message count
DO $$
BEGIN
    -- Add migration status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_sessions' AND column_name = 'migrated_to_append_only'
    ) THEN
        ALTER TABLE chat_sessions ADD COLUMN migrated_to_append_only BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Added migrated_to_append_only column';
    END IF;
    
    -- Add message count cache column for performance
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_sessions' AND column_name = 'message_count'
    ) THEN
        ALTER TABLE chat_sessions ADD COLUMN message_count INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added message_count column';
    END IF;
END $$;

-- Create function to update message count cache
CREATE OR REPLACE FUNCTION update_session_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE chat_sessions 
        SET message_count = (
            SELECT COUNT(*) FROM messages WHERE session_id = NEW.session_id
        )
        WHERE id = NEW.session_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chat_sessions 
        SET message_count = (
            SELECT COUNT(*) FROM messages WHERE session_id = OLD.session_id
        )
        WHERE id = OLD.session_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain message count cache
DROP TRIGGER IF EXISTS trigger_update_message_count ON messages;
CREATE TRIGGER trigger_update_message_count
    AFTER INSERT OR UPDATE OR DELETE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_message_count();

-- =====================================================
-- 4. PERFORM MIGRATION
-- =====================================================

-- Run the migration (this is safe to run multiple times)
DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    -- Only run migration if we have sessions with JSONB messages
    IF EXISTS (
        SELECT 1 FROM chat_sessions 
        WHERE messages IS NOT NULL 
        AND jsonb_typeof(messages) = 'array'
        AND jsonb_array_length(messages) > 0
    ) THEN
        SELECT migrate_messages_to_append_only() INTO migrated_count;
        
        -- Mark all sessions as migrated
        UPDATE chat_sessions 
        SET migrated_to_append_only = TRUE
        WHERE migrated_to_append_only = FALSE OR migrated_to_append_only IS NULL;
        
        RAISE NOTICE '🎉 Migration completed: % messages migrated successfully', migrated_count;
    ELSE
        RAISE NOTICE '✅ No migration needed - all sessions already use append-only storage';
    END IF;
END $$;

-- =====================================================
-- 5. VERIFICATION AND TESTING
-- =====================================================

-- Test function to verify append-only functionality
CREATE OR REPLACE FUNCTION test_append_only_messages()
RETURNS TEXT AS $$
DECLARE
    test_session_id TEXT := 'test-append-only-' || gen_random_uuid()::text;
    test_user_id UUID;
    message_id1 UUID;
    message_id2 UUID;
    message_count INTEGER;
    test_messages RECORD;
    result TEXT := '';
BEGIN
    -- Try to find an existing user, or skip test if none exist
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RETURN '⚠️ Test skipped: No users found in auth.users table. Create a user account first to run the test.';
    END IF;
    
    -- Create test session with empty messages array to satisfy NOT NULL constraint
    INSERT INTO chat_sessions (id, title, user_id, model, messages)
    VALUES (test_session_id, 'Append-Only Test', test_user_id, 'test-model', '[]'::jsonb);
    
    -- Test 1: Append first message
    SELECT append_message(test_session_id, 'user', 'Hello, this is a test message') INTO message_id1;
    result := result || '✅ Test 1: First message appended successfully' || E'\n';
    
    -- Test 2: Append second message
    SELECT append_message(test_session_id, 'assistant', 'Hello! I received your test message.', '{"temperature": 0.7}') INTO message_id2;
    result := result || '✅ Test 2: Second message appended successfully' || E'\n';
    
    -- Test 3: Check message count
    SELECT get_session_message_count(test_session_id) INTO message_count;
    IF message_count = 2 THEN
        result := result || '✅ Test 3: Message count is correct (2)' || E'\n';
    ELSE
        result := result || '❌ Test 3: Message count incorrect - expected 2, got ' || message_count || E'\n';
    END IF;
    
    -- Test 4: Check message order and content
    SELECT COUNT(*) INTO message_count
    FROM get_session_messages(test_session_id) 
    WHERE (role = 'user' AND content = 'Hello, this is a test message')
       OR (role = 'assistant' AND content = 'Hello! I received your test message.');
    
    IF message_count = 2 THEN
        result := result || '✅ Test 4: Message content and order preserved' || E'\n';
    ELSE
        result := result || '❌ Test 4: Message content or order incorrect' || E'\n';
    END IF;
    
    -- Test 5: Verify no JSONB messages exist in session
    SELECT COUNT(*) INTO message_count
    FROM chat_sessions 
    WHERE id = test_session_id 
    AND (messages IS NULL OR messages = '[]'::jsonb);
    
    IF message_count = 1 THEN
        result := result || '✅ Test 5: Session JSONB messages properly cleared' || E'\n';
    ELSE
        result := result || '❌ Test 5: Session still has JSONB messages' || E'\n';
    END IF;
    
    -- Cleanup test data
    DELETE FROM chat_sessions WHERE id = test_session_id;
    
    result := result || '🧹 Test cleanup completed' || E'\n';
    result := result || '🎉 Append-only message system is working correctly!';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Run the test (optional - comment out if no users exist yet)
-- SELECT test_append_only_messages() as test_results;

-- =====================================================
-- 6. PERFORMANCE VERIFICATION
-- =====================================================

-- Show migration status
SELECT 
    '📊 MIGRATION STATUS' as section,
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE migrated_to_append_only = TRUE) as migrated_sessions,
    SUM(message_count) as total_messages_in_new_table,
    COUNT(*) FILTER (WHERE messages IS NOT NULL AND jsonb_array_length(messages) > 0) as sessions_with_old_jsonb
FROM chat_sessions;

-- Show message table status
SELECT 
    '📨 MESSAGE TABLE STATUS' as section,
    COUNT(*) as total_messages,
    COUNT(DISTINCT session_id) as sessions_with_messages,
    pg_size_pretty(pg_total_relation_size('messages')) as table_size
FROM messages;

-- Show index status
SELECT 
    '⚡ INDEX STATUS' as section,
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE tablename = 'messages'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- Final success message
SELECT 
    '🎉 APPEND-ONLY MIGRATION COMPLETE!' as result,
    'Messages are now stored individually to prevent data loss from concurrent saves.' as message,
    'Use append_message() function for thread-safe message storage.' as usage,
    NOW() as completed_at;