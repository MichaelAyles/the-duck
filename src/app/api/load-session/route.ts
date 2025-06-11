import { SupabaseDatabaseService } from '@/lib/db/supabase-operations'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 📚 Load a specific chat session
 * 
 * This route is responsible for loading the messages of a specific chat 
 * session from the database when a user selects a conversation from their 
 * chat history.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const session = await SupabaseDatabaseService.getChatSession(supabase, sessionId, user.id)

    if (!session) {
      return NextResponse.json(
        { error: 'Chat session not found or you do not have access' },
        { status: 404 }
      )
    }

    return NextResponse.json({ session })

  } catch (error) {
    console.error('Load session error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to load chat session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 