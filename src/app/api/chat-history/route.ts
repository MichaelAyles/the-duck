import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseDatabaseService } from '@/lib/db/supabase-operations'

/**
 * 📜 Chat History API
 * 
 * Fetches user's chat history with pagination and search support
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || ''

    let sessions

    if (search) {
      sessions = await SupabaseDatabaseService.searchChatSessions(supabase, search, user.id, limit)
    } else {
      sessions = await SupabaseDatabaseService.getAllChatSessions(supabase, user.id, limit, offset)
    }

    // Format the response
    const formattedSessions = sessions.map(session => {
      const messages = Array.isArray(session.messages) ? session.messages as any[] : []
      const messageCount = messages.length
      const lastMessage = messages[messages.length - 1] as any
      const firstUserMessage = messages.find((msg: any) => msg.role === 'user') as any

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

    const total = search 
      ? formattedSessions.length 
      : (await SupabaseDatabaseService.getStats(supabase, user.id)).totalSessions

    return NextResponse.json({
      sessions: formattedSessions,
      pagination: {
        limit,
        offset,
        hasMore: sessions.length === limit,
        total: total
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
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    await SupabaseDatabaseService.deleteChatSession(supabase, sessionId, user.id)

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
function getConversationPreview(messages: any[]): string {
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