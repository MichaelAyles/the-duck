import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DatabaseService } from '@/lib/db/operations'
import { Message } from '@/components/chat/chat-interface'
import { nanoid } from 'nanoid'

/**
 * 🔬 Database Test API Route
 * 
 * Tests the Supabase database operations to ensure
 * database connectivity and operations are working properly
 */

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    // Test database statistics
    const stats = await DatabaseService.getStats(supabase, userId);
    
    // Test retrieving recent sessions
    const recentSessions = await DatabaseService.getAllChatSessions(supabase, userId, 5);
    
    // Test getting sessions with summaries
    const sessionsWithSummaries = await DatabaseService.getSessionsWithSummaries(supabase, userId, 3);
    
    return NextResponse.json({
      status: 'success',
      message: 'Supabase database operations test completed',
      data: {
        stats,
        recentSessions: recentSessions.map(session => ({
          id: session.id,
          title: session.title,
          model: session.model,
          isActive: session.is_active,
          createdAt: session.created_at,
          userId: session.user_id,
          messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
        })),
        sessionsWithSummaries: sessionsWithSummaries.map(({ session, summary }) => ({
          session: {
            id: session.id,
            title: session.title,
            isActive: session.is_active,
            userId: session.user_id,
          },
          hasSummary: !!summary,
          summaryTopics: summary?.key_topics || [],
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database test error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Supabase database operations test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Create a test chat session
    const testSessionId = `test-${nanoid()}`;
    const testMessages: Message[] = [
      {
        id: nanoid(),
        role: 'user',
        content: 'Hello, this is a test message for Supabase database verification.',
        timestamp: new Date(),
      },
      {
        id: nanoid(),
        role: 'assistant',
        content: 'Hello! This is a test response to verify that our Supabase database operations are working correctly.',
        timestamp: new Date(),
      },
    ];

    // Test saving a chat session
    const savedSession = await DatabaseService.saveChatSession(
      supabase,
      testSessionId,
      'Supabase Database Test',
      testMessages,
      'gpt-4o-mini',
      user.id
    );

    // Test creating a summary
    const testSummaryId = `summary-${nanoid()}`;
    const savedSummary = await DatabaseService.saveChatSummary(
      supabase,
      testSummaryId,
      testSessionId,
      'Test summary for Supabase database verification',
      ['testing', 'database', 'supabase'],
      { testMode: true, service: 'supabase' },
      { formality: 0.7, verbosity: 0.5 }
    );

    // Test retrieving the session
    const retrievedSession = await DatabaseService.getChatSession(supabase, testSessionId, user.id);
    const retrievedSummary = await DatabaseService.getChatSummary(supabase, testSessionId);

    // Clean up test data
    await DatabaseService.deleteChatSession(supabase, testSessionId, user.id);

    return NextResponse.json({
      status: 'success',
      message: 'Supabase database CRUD operations test completed successfully',
      data: {
        savedSession: {
          id: savedSession.id,
          title: savedSession.title,
          model: savedSession.model,
          messageCount: Array.isArray(savedSession.messages) ? savedSession.messages.length : 0,
        },
        savedSummary: {
          id: savedSummary.id,
          sessionId: savedSummary.session_id,
          summary: savedSummary.summary,
          topics: savedSummary.key_topics,
        },
        retrievalTest: {
          sessionRetrieved: !!retrievedSession,
          summaryRetrieved: !!retrievedSummary,
        },
        cleanupCompleted: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database CRUD test error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Supabase database CRUD operations test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 