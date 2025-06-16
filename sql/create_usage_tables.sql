-- Create tables for credit usage tracking

-- User credits configuration
CREATE TABLE IF NOT EXISTS user_credits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    credit_limit DECIMAL(10, 2) DEFAULT 10.00, -- $10 default limit
    credits_used DECIMAL(10, 2) DEFAULT 0.00,
    reset_period TEXT DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly', 'never'
    last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User usage records
CREATE TABLE IF NOT EXISTS user_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    prompt_cost DECIMAL(10, 6) NOT NULL,
    completion_cost DECIMAL(10, 6) NOT NULL,
    total_cost DECIMAL(10, 6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX idx_user_usage_created_at ON user_usage(created_at);
CREATE INDEX idx_user_usage_session_id ON user_usage(session_id);

-- Enable Row Level Security
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_credits
CREATE POLICY "Users can view their own credits" ON user_credits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits" ON user_credits
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credits" ON user_credits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_usage
CREATE POLICY "Users can view their own usage" ON user_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage" ON user_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE
    ON user_credits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reset credits based on period
CREATE OR REPLACE FUNCTION reset_user_credits()
RETURNS void AS $$
BEGIN
    -- Reset daily credits
    UPDATE user_credits
    SET credits_used = 0.00, last_reset = NOW()
    WHERE reset_period = 'daily' 
    AND last_reset < NOW() - INTERVAL '1 day';
    
    -- Reset weekly credits
    UPDATE user_credits
    SET credits_used = 0.00, last_reset = NOW()
    WHERE reset_period = 'weekly' 
    AND last_reset < NOW() - INTERVAL '1 week';
    
    -- Reset monthly credits
    UPDATE user_credits
    SET credits_used = 0.00, last_reset = NOW()
    WHERE reset_period = 'monthly' 
    AND last_reset < NOW() - INTERVAL '1 month';
END;
$$ language 'plpgsql';

-- Create a scheduled job to reset credits (requires pg_cron extension)
-- This would need to be set up separately in Supabase dashboard
-- SELECT cron.schedule('reset-user-credits', '0 0 * * *', 'SELECT reset_user_credits();');