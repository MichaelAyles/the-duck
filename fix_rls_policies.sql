-- 🦆 Fix RLS Policies for The Duck
-- Run this in your Supabase SQL Editor to fix the user_preferences RLS policies

-- First, let's check if RLS is enabled
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_preferences;

-- Create comprehensive RLS policies for user_preferences
-- Policy for SELECT (viewing preferences)
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for INSERT (creating new preferences)
CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE (modifying existing preferences)
CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy for DELETE (removing preferences - optional)
CREATE POLICY "Users can delete own preferences" ON public.user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Ensure proper permissions are granted
GRANT ALL ON public.user_preferences TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Check that auth.uid() function is working
-- You can test this with: SELECT auth.uid();
-- It should return your user ID when you're authenticated

-- Optional: Temporarily disable RLS to test if that's the issue
-- ALTER TABLE public.user_preferences DISABLE ROW LEVEL SECURITY;
-- ⚠️ ONLY for testing - make sure to re-enable it afterwards! 