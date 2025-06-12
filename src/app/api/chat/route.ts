import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter'
import { 
  withSecurity, 
  withRateLimit, 
  withApiKeyValidation,
  withInputValidation,
  InputValidation,
  SecurityAudit,
  SECURITY_CONFIG
} from '@/lib/security'

// Helper function to convert text to duck speak
function convertToDuckSpeak(text: string): string {
  // Replace each word with "quack" while preserving punctuation and spacing
  return text.replace(/\b\w+\b/g, 'quack');
}

// Define interface for validated chat request data
interface ChatRequestData {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  model: string;
  sessionId?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  };
  tone?: string;
}

// Core handler function
async function handleChatRequest(request: NextRequest, validatedData: ChatRequestData): Promise<NextResponse> {
  try {
    const { messages, model, stream = true, options = {}, tone = "match-user" } = validatedData;

    // Create system prompt to establish The Duck's identity
    const systemPrompt = tone === "duck" 
      ? "You are The Duck, a friendly AI assistant. You must respond only with 'quack' repeated in various patterns. Express different emotions and meanings through variations in your quacking - use 'Quack!' for excitement, 'quack quack' for agreement, 'Quack?' for questions, etc."
      : "You are The Duck, a helpful AI assistant. You are friendly, knowledgeable, and direct in your responses. Answer questions clearly and helpfully without excessive duck-themed language or metaphors. Focus on being genuinely useful rather than overly playful.";

    // Sanitize messages content and ensure proper format
    const sanitizedMessages = [
      {
        id: 'system-prompt',
        role: 'system' as const,
        content: systemPrompt,
        timestamp: new Date()
      },
      ...messages.map((message, index) => ({
        id: `msg-${index}`, // Add required id field
        role: message.role as 'user' | 'assistant' | 'system',
        content: InputValidation.sanitizeInput(message.content),
        timestamp: new Date() // Add required timestamp field
      }))
    ];

    const apiKey = process.env.OPENROUTER_API_KEY!; // API key validated by middleware

    const client = new OpenRouterClient(apiKey)

    if (stream) {
      // Return streaming response
      const encoder = new TextEncoder()
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let tokenCount = 0;
            for await (const chunk of client.streamChat(sanitizedMessages, model, options)) {
              const processedChunk = tone === "duck" ? convertToDuckSpeak(chunk) : chunk;
              const data = `data: ${JSON.stringify({ content: processedChunk })}\n\n`
              controller.enqueue(encoder.encode(data))
              tokenCount += chunk.length; // Approximate token count
            }
            
            // Log API usage for monitoring
            SecurityAudit.logApiUsage('/api/chat', model, tokenCount, request);
            
            // Send completion signal
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            console.error('Streaming error:', error)
            const errorData = `data: ${JSON.stringify({ 
              error: error instanceof Error ? error.message : 'Unknown error' 
            })}\n\n`
            controller.enqueue(encoder.encode(errorData))
            controller.close()
          }
        },
      })

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      // Return non-streaming response
      const response = await client.chat(sanitizedMessages, model, options)
      const processedResponse = tone === "duck" ? convertToDuckSpeak(response) : response;
      
      // Log API usage for monitoring
      SecurityAudit.logApiUsage('/api/chat', model, response.length, request);
      
      return NextResponse.json({ content: processedResponse })
    }
  } catch (error) {
    console.error('Chat API error:', error)
    
    // Log error for monitoring
    console.error('Chat API error details:', {
      endpoint: '/api/chat',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Apply security middleware chain
export const POST = withSecurity(
  withRateLimit(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.CHAT)(
    withApiKeyValidation(
      withInputValidation(InputValidation.chatRequestSchema)(
        handleChatRequest
      )
    )
  )
);

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}