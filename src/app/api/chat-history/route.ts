import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 📜 Chat History API
 * 
 * Fetches user's chat history with pagination and search support
 * This is a proxy to the sessions API for backward compatibility
 */

export async function GET(req: NextRequest) {
  try {
    // Check authentication first
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Forward to sessions API with same parameters
    const { searchParams } = new URL(req.url)
    const sessionsUrl = new URL('/api/sessions', req.url)
    
    // Copy all search params
    searchParams.forEach((value, key) => {
      sessionsUrl.searchParams.set(key, value)
    })

    const response = await fetch(sessionsUrl.toString(), {
      method: 'GET',
      headers: {
        'Cookie': req.headers.get('cookie') || '',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()
    const sessions = data.sessions || []

    // Define interface for session data
    interface SessionData {
      id: string;
      title: string;
      created_at: string;
      updated_at: string;
      is_active: boolean;
      messages: Array<{ role: string; content: string }>;
      model: string;
    }

    // Format the response to match the expected format
    const formattedSessions = sessions.map((session: SessionData) => {
      const messages = Array.isArray(session.messages) ? session.messages : []
      const messageCount = messages.length
      const lastMessage = messages[messages.length - 1]
      const firstUserMessage = messages.find((msg) => msg.role === 'user')

      return {
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        isActive: session.is_active,
        messageCount,
        lastMessage: lastMessage?.content?.slice(0, 100) || '',
        firstUserMessage: firstUserMessage?.content?.slice(0, 100) || '',
        model: session.model,
        preview: getConversationPreview(messages)
      }
    })

    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    return NextResponse.json({
      sessions: formattedSessions,
      pagination: {
        limit,
        offset,
        hasMore: sessions.length === limit,
        total: sessions.length // We don't have total count from the API
      }
    })
  } catch (error) {
    console.error('Chat history error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch chat history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * 🗑️ Delete a chat session
 */
export async function DELETE(req: NextRequest) {
  try {
    // Check authentication first
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if this is a delete all request
    const body = await req.json().catch(() => ({}))
    const deleteAll = body.deleteAll === true

    if (deleteAll) {
      // Delete all chat sessions for this user
      const { error: deleteError } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Failed to delete all chat sessions:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete chat history' },
          { status: 500 }
        )
      }

      // Also delete all summaries (cascading delete should handle this, but just in case)
      const { error: summaryError } = await supabase
        .from('chat_summaries')
        .delete()
        .eq('user_id', user.id)

      if (summaryError) {
        console.error('Failed to delete chat summaries:', summaryError)
        // Don't fail the request if summaries can't be deleted
      }

      return NextResponse.json({
        success: true,
        message: 'All chat history deleted successfully'
      })
    }

    // Handle single session deletion
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Forward to sessions API
    const deleteUrl = new URL(`/api/sessions/${sessionId}`, req.url)
    
    const response = await fetch(deleteUrl.toString(), {
      method: 'DELETE',
      headers: {
        'Cookie': req.headers.get('cookie') || '',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: response.status })
    }

    return NextResponse.json({
      success: true,
      message: 'Chat session deleted successfully'
    })
  } catch (error) {
    console.error('Delete chat error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete chat session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Helper function to create a conversation preview
 */
function getConversationPreview(messages: Array<{ role: string; content: string }>): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Empty conversation'
  }

  const firstUser = messages.find(msg => msg.role === 'user')
  const firstAssistant = messages.find(msg => msg.role === 'assistant' && msg.content.length > 10)

  if (firstUser && firstAssistant) {
    const userPreview = firstUser.content.slice(0, 50)
    const assistantPreview = firstAssistant.content.slice(0, 50)
    return `User: ${userPreview}... | Assistant: ${assistantPreview}...`
  } else if (firstUser) {
    return `User: ${firstUser.content.slice(0, 100)}...`
  } else {
    return 'Conversation started'
  }
}