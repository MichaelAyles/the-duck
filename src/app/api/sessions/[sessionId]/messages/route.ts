import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Verify user owns the session
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, title, model, created_at, updated_at')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    // Get messages using the optimized function
    const { data: messages, error: messagesError } = await supabase
      .rpc('get_session_messages', {
        p_session_id: sessionId
      })

    if (messagesError) {
      logger.error('Failed to fetch messages:', messagesError)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // Format messages for client
    const formattedMessages = (messages || []).map((msg: Record<string, unknown>) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata || {},
      createdAt: msg.created_at
    }))

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        model: session.model,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      },
      messages: formattedMessages,
      messageCount: formattedMessages.length
    })

  } catch (error) {
    logger.error('Error in GET /api/sessions/[sessionId]/messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}