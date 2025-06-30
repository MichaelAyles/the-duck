-- =====================================================
-- MANUAL TEST FOR APPEND-ONLY MESSAGES
-- =====================================================
-- Run this script AFTER the main migration to test functionality
-- This requires at least one user to exist in auth.users
-- =====================================================

-- Test the append-only message system
SELECT test_append_only_messages() as test_results;

-- Alternative test using a real user (replace YOUR_USER_ID with actual user ID)
-- DO $$
-- DECLARE
--     test_session_id TEXT := 'manual-test-' || gen_random_uuid()::text;
--     your_user_id UUID := 'YOUR_USER_ID_HERE'; -- Replace with real user ID
--     message_id UUID;
-- BEGIN
--     -- Create test session
--     INSERT INTO chat_sessions (id, title, user_id, model, messages)
--     VALUES (test_session_id, 'Manual Test Session', your_user_id, 'test-model', '[]'::jsonb);
--     
--     -- Test message appending
--     SELECT append_message(test_session_id, 'user', 'Test message 1') INTO message_id;
--     RAISE NOTICE 'Message 1 ID: %', message_id;
--     
--     SELECT append_message(test_session_id, 'assistant', 'Test response 1') INTO message_id;
--     RAISE NOTICE 'Message 2 ID: %', message_id;
--     
--     -- Check results
--     RAISE NOTICE 'Total messages: %', get_session_message_count(test_session_id);
--     
--     -- Clean up
--     DELETE FROM chat_sessions WHERE id = test_session_id;
--     RAISE NOTICE 'Test completed and cleaned up';
-- END $$;

-- Show current migration status
SELECT 
    '📊 FINAL MIGRATION STATUS' as section,
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE migrated_to_append_only = TRUE) as migrated_sessions,
    SUM(message_count) as total_messages_in_new_table,
    COUNT(*) FILTER (WHERE messages IS NOT NULL AND jsonb_array_length(messages) > 0) as sessions_with_old_jsonb,
    CASE 
        WHEN COUNT(*) FILTER (WHERE messages IS NOT NULL AND jsonb_array_length(messages) > 0) = 0 
        THEN '✅ All sessions migrated successfully'
        ELSE '⚠️ Some sessions still have JSONB messages'
    END as migration_status
FROM chat_sessions;

-- Verify message table functionality
SELECT 
    '📨 MESSAGE TABLE VERIFICATION' as section,
    COUNT(*) as total_messages,
    COUNT(DISTINCT session_id) as sessions_with_messages,
    pg_size_pretty(pg_total_relation_size('messages')) as table_size,
    CASE 
        WHEN COUNT(*) > 0 
        THEN '✅ Message table has data'
        ELSE '⚠️ Message table is empty'
    END as table_status
FROM messages;

-- Test essential functions
SELECT 
    '🔧 FUNCTION VERIFICATION' as section,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'append_message')
        THEN '✅ append_message function exists'
        ELSE '❌ append_message function missing'
    END as append_function,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_session_messages')
        THEN '✅ get_session_messages function exists'
        ELSE '❌ get_session_messages function missing'
    END as get_function,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_session_message_count')
        THEN '✅ get_session_message_count function exists'
        ELSE '❌ get_session_message_count function missing'
    END as count_function;

-- Final success message
SELECT 
    '🎉 APPEND-ONLY MIGRATION VERIFICATION COMPLETE!' as result,
    'The migration script has completed successfully.' as message,
    'You can now use the new append-only message functions.' as next_steps,
    NOW() as verified_at;