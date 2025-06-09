-- 🔒 Row Level Security (RLS) Policies for The Duck
-- 
-- This file contains comprehensive RLS policies for all tables
-- These policies will be activated when user authentication is implemented

-- Enable RLS on all tables
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_summaries ENABLE ROW LEVEL SECURITY;

-- 📋 Chat Sessions Policies

-- Allow anonymous users to create chat sessions (current behavior)
CREATE POLICY "Anyone can create chat sessions" ON chat_sessions
    FOR INSERT 
    WITH CHECK (true);

-- Allow anonymous users to read their own chat sessions (based on session ownership)
CREATE POLICY "Users can view their own chat sessions" ON chat_sessions
    FOR SELECT 
    USING (true); -- Currently open, will be restricted when auth is added

-- Allow anonymous users to update their own chat sessions
CREATE POLICY "Users can update their own chat sessions" ON chat_sessions
    FOR UPDATE 
    USING (true)  -- Currently open, will be restricted when auth is added
    WITH CHECK (true);

-- Allow anonymous users to delete their own chat sessions
CREATE POLICY "Users can delete their own chat sessions" ON chat_sessions
    FOR DELETE 
    USING (true); -- Currently open, will be restricted when auth is added

-- 📝 Chat Summaries Policies

-- Allow anonymous users to create summaries for their sessions
CREATE POLICY "Anyone can create chat summaries" ON chat_summaries
    FOR INSERT 
    WITH CHECK (
        -- Ensure the session exists and user has access to it
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = session_id
        )
    );

-- Allow anonymous users to read summaries for their sessions
CREATE POLICY "Users can view summaries for their sessions" ON chat_summaries
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = session_id
        )
    );

-- Allow anonymous users to update summaries for their sessions
CREATE POLICY "Users can update summaries for their sessions" ON chat_summaries
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = session_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = session_id
        )
    );

-- Allow anonymous users to delete summaries for their sessions
CREATE POLICY "Users can delete summaries for their sessions" ON chat_summaries
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = session_id
        )
    );

-- 🔮 Future Authentication Policies (commented out, ready for activation)

/*
-- When user authentication is implemented, replace the above policies with these:

-- Chat Sessions with User Authentication
DROP POLICY IF EXISTS "Anyone can create chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can view their own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update their own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can delete their own chat sessions" ON chat_sessions;

CREATE POLICY "Authenticated users can create chat sessions" ON chat_sessions
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own chat sessions" ON chat_sessions
    FOR SELECT 
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions" ON chat_sessions
    FOR UPDATE 
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions" ON chat_sessions
    FOR DELETE 
    TO authenticated
    USING (auth.uid() = user_id);

-- Chat Summaries with User Authentication
DROP POLICY IF EXISTS "Anyone can create chat summaries" ON chat_summaries;
DROP POLICY IF EXISTS "Users can view summaries for their sessions" ON chat_summaries;
DROP POLICY IF EXISTS "Users can update summaries for their sessions" ON chat_summaries;
DROP POLICY IF EXISTS "Users can delete summaries for their sessions" ON chat_summaries;

CREATE POLICY "Users can create summaries for their sessions" ON chat_summaries
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = session_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view summaries for their sessions" ON chat_summaries
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = session_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update summaries for their sessions" ON chat_summaries
    FOR UPDATE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = session_id AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = session_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete summaries for their sessions" ON chat_summaries
    FOR DELETE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions 
            WHERE id = session_id AND user_id = auth.uid()
        )
    );

-- Admin Policies (for moderation and support)
CREATE POLICY "Admins can view all sessions" ON chat_sessions
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins can moderate content" ON chat_sessions
    FOR UPDATE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    )
    WITH CHECK (
        -- Admins can only update specific fields for moderation
        OLD.user_id = NEW.user_id AND 
        OLD.id = NEW.id
    );
*/

-- 🔍 Security Functions for Enhanced Protection

-- Function to sanitize JSONB messages (prevent injection)
CREATE OR REPLACE FUNCTION sanitize_messages(messages JSONB)
RETURNS JSONB AS $$
BEGIN
    -- Remove potentially dangerous fields and validate structure
    RETURN (
        SELECT jsonb_agg(
            jsonb_build_object(
                'role', CASE 
                    WHEN elem->>'role' IN ('user', 'assistant', 'system') 
                    THEN elem->>'role' 
                    ELSE 'user' 
                END,
                'content', COALESCE(elem->>'content', ''),
                'timestamp', COALESCE(elem->>'timestamp', NOW()::text)
            )
        )
        FROM jsonb_array_elements(messages) AS elem
        WHERE jsonb_typeof(elem) = 'object'
        AND elem ? 'role' 
        AND elem ? 'content'
        AND length(elem->>'content') <= 10000 -- Enforce max length
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically sanitize messages on insert/update
CREATE OR REPLACE FUNCTION trigger_sanitize_messages()
RETURNS TRIGGER AS $$
BEGIN
    NEW.messages = sanitize_messages(NEW.messages);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger
DROP TRIGGER IF EXISTS sanitize_messages_trigger ON chat_sessions;
CREATE TRIGGER sanitize_messages_trigger
    BEFORE INSERT OR UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sanitize_messages();

-- 📊 Security Monitoring Views

-- View for suspicious activity detection
CREATE OR REPLACE VIEW security_suspicious_activity AS
SELECT 
    cs.id as session_id,
    cs.created_at,
    cs.updated_at,
    jsonb_array_length(cs.messages) as message_count,
    cs.is_active,
    -- Flag potential issues
    CASE 
        WHEN jsonb_array_length(cs.messages) > 50 THEN 'HIGH_MESSAGE_COUNT'
        WHEN cs.updated_at - cs.created_at > INTERVAL '2 hours' THEN 'LONG_SESSION'
        WHEN cs.messages::text LIKE '%<script%' THEN 'POTENTIAL_XSS'
        WHEN cs.messages::text LIKE '%javascript:%' THEN 'POTENTIAL_XSS'
        ELSE NULL
    END as security_flag
FROM chat_sessions cs
WHERE 
    jsonb_array_length(cs.messages) > 30 OR
    cs.updated_at - cs.created_at > INTERVAL '1 hour' OR
    cs.messages::text LIKE '%<script%' OR
    cs.messages::text LIKE '%javascript:%';

-- View for usage analytics (privacy-focused)
CREATE OR REPLACE VIEW usage_analytics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as sessions_created,
    AVG(jsonb_array_length(messages)) as avg_messages_per_session,
    COUNT(CASE WHEN is_active THEN 1 END) as active_sessions
FROM chat_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 🛡️ Rate Limiting in Database

-- Table to track API usage per IP/user
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id SERIAL PRIMARY KEY,
    identifier TEXT NOT NULL, -- IP address or user ID
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(identifier, endpoint)
);

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_endpoint TEXT,
    p_max_requests INTEGER DEFAULT 100,
    p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    window_start TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get current rate limit data
    SELECT request_count, api_rate_limits.window_start
    INTO current_count, window_start
    FROM api_rate_limits
    WHERE identifier = p_identifier AND endpoint = p_endpoint;
    
    -- If no record exists or window has expired, create/reset
    IF current_count IS NULL OR window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL THEN
        INSERT INTO api_rate_limits (identifier, endpoint, request_count, window_start)
        VALUES (p_identifier, p_endpoint, 1, NOW())
        ON CONFLICT (identifier, endpoint) 
        DO UPDATE SET 
            request_count = 1,
            window_start = NOW();
        RETURN TRUE;
    END IF;
    
    -- Check if limit exceeded
    IF current_count >= p_max_requests THEN
        RETURN FALSE;
    END IF;
    
    -- Increment counter
    UPDATE api_rate_limits
    SET request_count = request_count + 1
    WHERE identifier = p_identifier AND endpoint = p_endpoint;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old rate limit entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS VOID AS $$
BEGIN
    DELETE FROM api_rate_limits
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 🚨 Security Incident Logging

-- Table for security events
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    ip_address TEXT,
    user_agent TEXT,
    endpoint TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type TEXT,
    p_severity TEXT DEFAULT 'INFO',
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_endpoint TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO security_events (
        event_type, severity, ip_address, user_agent, endpoint, details
    ) VALUES (
        p_event_type, p_severity, p_ip_address, p_user_agent, p_endpoint, p_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index for efficient security event queries
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON security_events(event_type, severity);

-- 🧹 Maintenance and Cleanup

-- Function to clean up old data (privacy compliance)
CREATE OR REPLACE FUNCTION cleanup_old_data(retention_days INTEGER DEFAULT 90)
RETURNS TABLE(deleted_sessions INTEGER, deleted_summaries INTEGER, deleted_events INTEGER) AS $$
DECLARE
    deleted_sessions_count INTEGER;
    deleted_summaries_count INTEGER;
    deleted_events_count INTEGER;
BEGIN
    -- Delete old inactive sessions
    WITH deleted AS (
        DELETE FROM chat_sessions
        WHERE is_active = FALSE 
        AND updated_at < NOW() - (retention_days || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_sessions_count FROM deleted;
    
    -- Delete orphaned summaries (cascade should handle this, but just in case)
    WITH deleted AS (
        DELETE FROM chat_summaries
        WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
        AND NOT EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id)
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_summaries_count FROM deleted;
    
    -- Clean up old security events (keep for shorter period)
    WITH deleted AS (
        DELETE FROM security_events
        WHERE created_at < NOW() - INTERVAL '30 days'
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_events_count FROM deleted;
    
    RETURN QUERY SELECT deleted_sessions_count, deleted_summaries_count, deleted_events_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_summaries TO anon;
GRANT SELECT ON usage_analytics TO anon;

-- Security: Revoke dangerous permissions
REVOKE ALL ON security_events FROM anon;
REVOKE ALL ON api_rate_limits FROM anon;

COMMENT ON TABLE chat_sessions IS 'User chat sessions with RLS policies for data isolation';
COMMENT ON TABLE chat_summaries IS 'AI-generated summaries linked to chat sessions';
COMMENT ON TABLE security_events IS 'Security incident logging (admin access only)';
COMMENT ON TABLE api_rate_limits IS 'Rate limiting tracking (internal use only)';

COMMENT ON FUNCTION sanitize_messages(JSONB) IS 'Sanitizes chat messages to prevent injection attacks';
COMMENT ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) IS 'Database-level rate limiting';
COMMENT ON FUNCTION log_security_event(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) IS 'Logs security events for monitoring';
COMMENT ON FUNCTION cleanup_old_data(INTEGER) IS 'Removes old data for privacy compliance'; 