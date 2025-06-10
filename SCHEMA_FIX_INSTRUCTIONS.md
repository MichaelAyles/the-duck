# 🔧 Database Schema Fix Instructions

## Issue
Error: `Could not find the 'user_id' column of 'chat_sessions' in the schema cache`

## Root Cause
The database was created using the old Drizzle migration (`drizzle/0000_flippant_korg.sql`) which doesn't include the `user_id` column, but the application code expects it to exist.

## Solutions

### Option 1: Manual SQL Fix (Recommended)

1. **Open Supabase SQL Editor** in your project dashboard
2. **Run this SQL migration**:

```sql
-- Add user_id column to chat_sessions table
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);

-- Enable RLS (if not already enabled)
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON public.chat_sessions;

-- Create RLS policies for user data isolation
CREATE POLICY "Users can view own chat sessions" ON public.chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions" ON public.chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions" ON public.chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions" ON public.chat_sessions
    FOR DELETE USING (auth.uid() = user_id);
```

3. **Verify the fix** by checking your table structure in the Supabase dashboard

### Option 2: API-Based Fix (Development Only)

1. **Make sure you're in development mode** (`NODE_ENV=development`)
2. **Call the schema fix endpoint**:

```bash
# Check current schema
curl http://localhost:12000/api/fix-schema

# Apply the fix
curl -X POST http://localhost:12000/api/fix-schema
```

### Option 3: Complete Migration Reset

If you want to start fresh with the correct schema:

1. **Backup any important data** from your current database
2. **Drop existing tables**:
```sql
DROP TABLE IF EXISTS public.chat_summaries CASCADE;
DROP TABLE IF EXISTS public.chat_sessions CASCADE;
```

3. **Run the complete migration**:
```sql
-- Use the content from supabase_migration.sql
-- (This file already has the correct schema with user_id column)
```

## Verification

After applying the fix, you should be able to:

1. ✅ **Save chat sessions** without the user_id error
2. ✅ **See the user_id column** in your Supabase table editor
3. ✅ **Test the RLS policies** (users only see their own data)

## Test the Fix

Run a quick test to ensure everything works:

```bash
# In development, test the database operations
curl -X POST http://localhost:12000/api/database-test
```

## Notes

- **Existing chat sessions** will have `user_id = NULL` and won't be accessible due to RLS policies
- **New chat sessions** will automatically get the current user's ID
- **The TypeScript types** already include the user_id field, so no code changes needed
- **This fix is safe** - it only adds the missing column and doesn't modify existing data

## What This Enables

Once fixed, you'll have:
- ✅ **User data isolation** - each user only sees their own chats
- ✅ **Secure authentication** - Row Level Security prevents data leaks
- ✅ **Foundation for encryption** - user_id can be used as encryption key base
- ✅ **Multi-user support** - proper user session management

## If You Still Have Issues

1. **Check your environment variables** are properly set
2. **Verify Supabase connection** is working
3. **Look at the browser console** for detailed error messages
4. **Check the server logs** for more specific error details

The schema fix is a one-time operation that will resolve the user_id column error permanently. 