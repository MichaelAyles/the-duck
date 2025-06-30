import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/supabase'

type NewChatSession = Database['public']['Tables']['chat_sessions']['Insert']

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add search if provided
    if (search) {
      query = query.ilike('title', `%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch chat sessions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch chat sessions' },
        { status: 500 }
      )
    }

    return NextResponse.json({ sessions: data || [] })
  } catch (error) {
    console.error('Error in GET /api/sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, messages, model } = body

    if (!id || !title || !messages || !model) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const sessionData: NewChatSession = {
      id,
      title,
      messages: messages as Database['public']['Tables']['chat_sessions']['Row']['messages'],
      model,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .upsert(sessionData, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save chat session:', error)
      return NextResponse.json(
        { error: 'Failed to save chat session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ session: data })
  } catch (error) {
    console.error('Error in POST /api/sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}