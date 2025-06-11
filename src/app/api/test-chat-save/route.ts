import { SupabaseDatabaseService } from '@/lib/db/supabase-operations'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 🧪 Test Chat Save API
 *
 * This is a development-only endpoint to verify that chat sessions are
 * being saved to the database correctly.
 *
 * It simulates a full CRUD cycle:
 * 1. Creates a test chat session.
 * 2. Saves it to the database.
 * 3. Retrieves it to verify it was saved correctly.
 * 4. Deletes it to clean up.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const testSessionId = `test-session-${user.id}-${Date.now()}`
    const testMessages = [
      { role: 'user', content: 'This is a test message.' },
      { role: 'assistant', content: 'This is a test response.' },
    ]
    const testModel = 'test-model'

    // 1. Save the chat session
    const savedSession = await SupabaseDatabaseService.saveChatSession(
      supabase,
      testSessionId,
      'Test Session Title',
      testMessages as any,
      testModel,
      user.id
    )

    // 2. Retrieve the chat session
    const retrievedSession = await SupabaseDatabaseService.getChatSession(supabase, testSessionId, user.id)
    if (!retrievedSession || retrievedSession.id !== savedSession.id) {
      throw new Error('Failed to retrieve the saved session.')
    }

    // 3. Delete the chat session
    await SupabaseDatabaseService.deleteChatSession(supabase, testSessionId, user.id)

    return NextResponse.json({
      success: true,
      message: 'Chat save, retrieve, and delete cycle completed successfully.',
      data: {
        sessionId: testSessionId,
        userId: user.id
      }
    })

  } catch (error) {
    console.error('Test chat save error:', error)
    return NextResponse.json(
      {
        error: 'Test chat save failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 