import { NextResponse } from 'next/server'
import { SupabaseDatabaseService } from '@/lib/db/supabase-operations'
import { createClient } from '@supabase/supabase-js'

/**
 * 🧪 Test Chat Session Save
 * 
 * Tests if chat session saving works with proper user authentication
 */

export async function POST(req: Request) {
  try {
    // Get user from auth
    const authHeader = req.headers.get('authorization')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {}
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required for testing' },
        { status: 401 }
      )
    }

    // Test saving a chat session
    const testSessionId = `test-${Date.now()}`
    const testMessages = [
      {
        id: 'test-1',
        role: 'user',
        content: 'Hello, this is a test message',
        timestamp: new Date()
      },
      {
        id: 'test-2', 
        role: 'assistant',
        content: 'Hello! This is a test response.',
        timestamp: new Date()
      }
    ]

    await SupabaseDatabaseService.saveChatSession(
      testSessionId,
      'Test Chat Session',
      testMessages as any,
      'test-model',
      user.id
    )

    // Verify we can retrieve it
    const retrievedSession = await SupabaseDatabaseService.getChatSession(testSessionId, user.id)

    // Clean up
    await SupabaseDatabaseService.deleteChatSession(testSessionId, user.id)

    return NextResponse.json({
      success: true,
      message: 'Chat session save/retrieve test passed',
      userId: user.id,
      sessionSaved: !!retrievedSession,
      testSessionId
    })

  } catch (error) {
    console.error('Chat save test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 