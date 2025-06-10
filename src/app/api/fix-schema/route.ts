import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 🔧 Schema Fix API Endpoint
 * 
 * This endpoint checks and fixes the missing user_id column issue
 * Only works in development environment
 */

export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Schema fixes not available in production' },
      { status: 403 }
    )
  }

  try {
    // Create admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Check if user_id column exists
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'chat_sessions')
      .eq('table_schema', 'public')

    if (columnsError) {
      console.error('Error checking columns:', columnsError)
      return NextResponse.json(
        { error: 'Failed to check database schema', details: columnsError.message },
        { status: 500 }
      )
    }

    const hasUserIdColumn = columns?.some(col => col.column_name === 'user_id')
    
    if (!hasUserIdColumn) {
      // Add the user_id column using SQL
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: `
          -- Add user_id column
          ALTER TABLE public.chat_sessions 
          ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
          
          -- Create index
          CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
        `
      })

      if (alterError) {
        console.error('Error adding user_id column:', alterError)
        // Try alternative approach - direct column addition
        const { error: directError } = await supabase
          .from('chat_sessions')
          .select('id')
          .limit(1)

        return NextResponse.json({
          success: false,
          error: 'Failed to add user_id column',
          details: alterError.message,
          suggestion: 'Please run the migration manually in Supabase SQL editor',
          sqlToRun: `
-- Add user_id column to chat_sessions table
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can view own chat sessions" ON public.chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can insert own chat sessions" ON public.chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can update own chat sessions" ON public.chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can delete own chat sessions" ON public.chat_sessions
    FOR DELETE USING (auth.uid() = user_id);
          `
        }, { status: 500 })
      }
    }

    // Test the schema by attempting to insert a test record
    const testSessionId = `test-${Date.now()}`
    const { error: testError } = await supabase
      .from('chat_sessions')
      .insert({
        id: testSessionId,
        title: 'Schema Test',
        messages: [],
        model: 'test-model',
        user_id: null // Test with null user_id first
      })

    if (testError) {
      console.error('Schema test failed:', testError)
    } else {
      // Clean up test record
      await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', testSessionId)
    }

    return NextResponse.json({
      success: true,
      message: 'Database schema check completed',
      hasUserIdColumn,
      schemaFixed: !hasUserIdColumn,
      testPassed: !testError
    })

  } catch (error) {
    console.error('Schema fix error:', error)
    return NextResponse.json(
      { 
        error: 'Schema fix failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Schema info not available in production' },
      { status: 403 }
    )
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Get table schema info
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'chat_sessions')
      .eq('table_schema', 'public')
      .order('ordinal_position')

    if (error) {
      throw error
    }

    return NextResponse.json({
      tableName: 'chat_sessions',
      columns: columns || [],
      hasUserIdColumn: columns?.some(col => col.column_name === 'user_id') || false
    })

  } catch (error) {
    console.error('Schema info error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get schema info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 