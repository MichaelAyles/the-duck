import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for message validation
const AppendMessageSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, 'Content is required'),
  metadata: z.record(z.any()).optional().default({})
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate input
    const validation = AppendMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input', 
          details: validation.error.errors 
        }, 
        { status: 400 }
      )
    }

    const { sessionId, role, content, metadata } = validation.data

    // Verify user owns the session
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    // Use the append_message function for thread-safe insertion
    const { data: messageId, error: appendError } = await supabase
      .rpc('append_message', {
        p_session_id: sessionId,
        p_role: role,
        p_content: content,
        p_metadata: metadata
      })

    if (appendError) {
      console.error('Failed to append message:', appendError)
      return NextResponse.json(
        { error: 'Failed to append message' },
        { status: 500 }
      )
    }

    // Get the newly created message for response
    const { data: newMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (fetchError || !newMessage) {
      console.error('Failed to fetch new message:', fetchError)
      return NextResponse.json(
        { error: 'Message created but failed to retrieve' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: {
        id: newMessage.id,
        role: newMessage.role,
        content: newMessage.content,
        metadata: newMessage.metadata,
        createdAt: newMessage.created_at
      },
      sessionId
    })

  } catch (error) {
    console.error('Error in POST /api/messages/append:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}