import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withSecurity, withRateLimit, SECURITY_CONFIG } from '@/lib/security'
import { logger } from '@/lib/logger'

// Core handler function for memory context
async function handleMemoryContextRequest(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10) // Max 10 summaries

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Fetch recent chat summaries for the user by joining with chat_sessions
    const { data: summaries, error } = await supabase
      .from('chat_summaries')
      .select(`
        id,
        session_id,
        summary,
        key_topics,
        user_preferences,
        writing_style_analysis,
        created_at,
        chat_sessions!inner(user_id)
      `)
      .eq('chat_sessions.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('Failed to fetch chat summaries:', error)
      return NextResponse.json(
        { error: 'Failed to fetch memory context' },
        { status: 500 }
      )
    }

    // If no summaries found, return empty result
    if (!summaries || summaries.length === 0) {
      return NextResponse.json({
        summaries: [],
        count: 0,
        message: 'No previous conversation summaries found'
      })
    }

    // Return the summaries for memory context
    return NextResponse.json({
      summaries,
      count: summaries.length,
      limit
    })

  } catch (error) {
    logger.error('Memory context API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Apply security middleware
export const GET = withSecurity(
  withRateLimit(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.API)(
    handleMemoryContextRequest
  )
)

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}