-- Performance Optimization Indexes
-- These indexes improve query performance for common operations

-- =====================================================
-- MISSING PERFORMANCE INDEXES
-- =====================================================

-- Fix for sessions API performance issue (user_id + updated_at ordering)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);

-- Optimize user usage queries (frequently used in credits API)
CREATE INDEX IF NOT EXISTS idx_user_usage_user_endpoint ON user_usage(user_id, endpoint);

-- Optimize session queries with pagination
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_created ON chat_sessions(user_id, created_at DESC);

-- Optimize usage queries by timestamp range (for credit period calculations)
CREATE INDEX IF NOT EXISTS idx_user_usage_user_timestamp_range ON user_usage(user_id, timestamp) WHERE timestamp IS NOT NULL;

-- Optimize chat summaries by user (through session relationship)
CREATE INDEX IF NOT EXISTS idx_chat_summaries_user_via_session ON chat_summaries(session_id) INCLUDE (created_at, summary);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Show all indexes on chat_sessions table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'chat_sessions' 
ORDER BY indexname;

-- Show all indexes on user_usage table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'user_usage' 
ORDER BY indexname;

-- Performance validation message
SELECT '🚀 Performance indexes created successfully!' as result;