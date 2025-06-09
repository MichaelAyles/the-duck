import { NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db/operations'
import { Message } from '@/components/chat/chat-interface'
import { nanoid } from 'nanoid'

/**
 * 🔬 Database Test API Route
 * 
 * Tests the new Drizzle database operations to ensure
 * Phase 3 database consistency is working properly
 */

export async function GET() {
  try {
    // Test database statistics
    const stats = await DatabaseService.getStats();
    
    // Test retrieving recent sessions
    const recentSessions = await DatabaseService.getAllChatSessions(5);
    
    // Test getting sessions with summaries
    const sessionsWithSummaries = await DatabaseService.getSessionsWithSummaries(3);
    
    return NextResponse.json({
      status: 'success',
      message: 'Database operations test completed',
      data: {
        stats,
        recentSessions: recentSessions.map(session => ({
          id: session.id,
          title: session.title,
          model: session.model,
          isActive: session.isActive,
          createdAt: session.createdAt,
          messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
        })),
        sessionsWithSummaries: sessionsWithSummaries.map(({ session, summary }) => ({
          session: {
            id: session.id,
            title: session.title,
            isActive: session.isActive,
          },
          hasSummary: !!summary,
          summaryTopics: summary?.keyTopics || [],
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database test error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Database operations test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Create a test chat session
    const testSessionId = `test-${nanoid()}`;
    const testMessages: Message[] = [
      {
        id: nanoid(),
        role: 'user',
        content: 'Hello, this is a test message for Phase 3 database consistency verification.',
        timestamp: new Date(),
      },
      {
        id: nanoid(),
        role: 'assistant',
        content: 'Hello! This is a test response to verify that our Drizzle database operations are working correctly in Phase 3.',
        timestamp: new Date(),
      },
    ];

    // Test saving a chat session
    const savedSession = await DatabaseService.saveChatSession(
      testSessionId,
      'Phase 3 Database Test',
      testMessages,
      'gpt-4o-mini'
    );

    // Test creating a summary
    const testSummaryId = `summary-${nanoid()}`;
    const savedSummary = await DatabaseService.saveChatSummary(
      testSummaryId,
      testSessionId,
      'Test summary for Phase 3 database consistency verification',
      ['testing', 'database', 'phase-3'],
      { testMode: true, phase: 3 },
      { formality: 0.7, verbosity: 0.5 }
    );

    // Test retrieving the session
    const retrievedSession = await DatabaseService.getChatSession(testSessionId);
    const retrievedSummary = await DatabaseService.getChatSummary(testSessionId);

    // Clean up test data
    await DatabaseService.deleteChatSession(testSessionId);

    return NextResponse.json({
      status: 'success',
      message: 'Database CRUD operations test completed successfully',
      data: {
        savedSession: {
          id: savedSession.id,
          title: savedSession.title,
          model: savedSession.model,
          messageCount: Array.isArray(savedSession.messages) ? savedSession.messages.length : 0,
        },
        savedSummary: {
          id: savedSummary.id,
          sessionId: savedSummary.sessionId,
          summary: savedSummary.summary,
          keyTopics: savedSummary.keyTopics,
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
      message: 'Database CRUD operations test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 