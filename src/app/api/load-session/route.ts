import { NextRequest, NextResponse } from 'next/server'
import { SupabaseDatabaseService } from '@/lib/db/supabase-operations'
import { createClient } from '@supabase/supabase-js'

/**
 * 📥 Load Chat Session API
 * 
 * Loads messages for a specific chat session
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

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
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Load the session
    const session = await SupabaseDatabaseService.getChatSession(sessionId, user.id)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    // Format the messages
    const messages = Array.isArray(session.messages) ? session.messages : []

    return NextResponse.json({
      sessionId: session.id,
      title: session.title,
      messages,
      model: session.model,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      isActive: session.is_active
    })

  } catch (error) {
    console.error('Load session error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to load session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 