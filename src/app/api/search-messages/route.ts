import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withSecurity, withRateLimit, SECURITY_CONFIG } from '@/lib/security'
import { logger } from '@/lib/logger'

interface SearchResult {
  session_id: string
  session_title: string
  session_created_at: string
  session_model: string
  matching_messages: Array<{
    role: string
    content: string
    snippet: string
  }>
  relevance_score: number
}

// Core handler function for message search
async function handleSearchRequest(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Validate search query
    if (!query || query.length < 2) {
      return NextResponse.json({
        error: 'Search query must be at least 2 characters long'
      }, { status: 400 })
    }

    if (query.length > 200) {
      return NextResponse.json({
        error: 'Search query too long (max 200 characters)'
      }, { status: 400 })
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Search through chat sessions and their messages
    // We'll use PostgreSQL's JSONB operations to search within the messages array
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        title,
        created_at,
        model,
        messages
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      logger.error('Failed to fetch sessions for search:', error)
      return NextResponse.json(
        { error: 'Failed to search messages' },
        { status: 500 }
      )
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        results: [],
        total: 0,
        query,
        pagination: { limit, offset, hasMore: false }
      })
    }

    // Process sessions and search through message content
    const searchResults: SearchResult[] = []
    const searchTerm = query.toLowerCase()

    for (const session of sessions) {
      const messages = Array.isArray(session.messages) ? session.messages : []
      const matchingMessages: Array<{ role: string; content: string; snippet: string }> = []
      let relevanceScore = 0

      // Search through all messages in the session
      for (const message of messages) {
        if (message && typeof message.content === 'string') {
          const content = message.content.toLowerCase()
          
          // Check if the message content contains the search term
          if (content.includes(searchTerm)) {
            // Calculate relevance based on how many times the term appears
            const matches = (content.match(new RegExp(searchTerm, 'g')) || []).length
            relevanceScore += matches
            
            // Create a snippet around the first match
            const matchIndex = content.indexOf(searchTerm)
            const start = Math.max(0, matchIndex - 50)
            const end = Math.min(content.length, matchIndex + searchTerm.length + 50)
            let snippet = message.content.substring(start, end)
            
            // Add ellipsis if needed
            if (start > 0) snippet = '...' + snippet
            if (end < content.length) snippet = snippet + '...'
            
            matchingMessages.push({
              role: message.role,
              content: message.content,
              snippet
            })
          }
        }
      }

      // Also check session title for matches
      if (session.title.toLowerCase().includes(searchTerm)) {
        relevanceScore += 10 // Title matches are more relevant
      }

      // If we found matching messages, add to results
      if (matchingMessages.length > 0 || session.title.toLowerCase().includes(searchTerm)) {
        searchResults.push({
          session_id: session.id,
          session_title: session.title,
          session_created_at: session.created_at,
          session_model: session.model,
          matching_messages: matchingMessages.slice(0, 3), // Limit to 3 matching messages per session
          relevance_score: relevanceScore
        })
      }
    }

    // Sort by relevance score (descending)
    searchResults.sort((a, b) => b.relevance_score - a.relevance_score)

    // Apply pagination
    const total = searchResults.length
    const paginatedResults = searchResults.slice(offset, offset + limit)
    const hasMore = offset + limit < total

    return NextResponse.json({
      results: paginatedResults,
      total,
      query,
      pagination: {
        limit,
        offset,
        hasMore
      }
    })

  } catch (error) {
    logger.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Apply security middleware
export const GET = withSecurity(
  withRateLimit(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.API)(
    handleSearchRequest
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