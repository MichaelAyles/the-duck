import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Check if we have real Supabase or mock client
    const isRealSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!isRealSupabase) {
      return NextResponse.json({
        message: 'Using mock Supabase client - no real data available',
        sessions: { data: [], error: null, count: 0 },
        summaries: { data: [], error: null, count: 0 }
      })
    }

    // Check chat sessions - using type assertion for mock compatibility
    const { data: sessions, error: sessionsError } = await (supabase
      .from('chat_sessions')
      .select('*') as unknown as Promise<{ data: unknown[] | null; error: unknown }>)

    // Check chat summaries - using type assertion for mock compatibility
    const { data: summaries, error: summariesError } = await (supabase
      .from('chat_summaries')
      .select('*') as unknown as Promise<{ data: unknown[] | null; error: unknown }>)

    return NextResponse.json({
      sessions: {
        data: sessions,
        error: sessionsError,
        count: sessions?.length || 0
      },
      summaries: {
        data: summaries,
        error: summariesError,
        count: summaries?.length || 0
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 