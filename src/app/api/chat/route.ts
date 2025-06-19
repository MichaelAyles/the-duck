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
import { createClient } from '@/lib/supabase/server'
import { getUserLearningPreferences, createPersonalizedSystemPrompt } from '@/lib/learning-preferences'
import { logger } from '@/lib/logger'

// Helper function to convert text to duck speak
function convertToDuckSpeak(text: string): string {
  // Replace each word with "quack" while preserving punctuation and spacing
  return text.replace(/\b\w+\b/g, 'quack');
}

// Define interface for validated chat request data
interface ChatRequestData {
  messages: Array<{ 
    role: 'user' | 'assistant' | 'system'; 
    content: string;
    attachments?: Array<{
      id: string;
      file_name: string;
      file_type: string;
      file_size: number;
      mime_type: string;
      url?: string;
    }>;
  }>;
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
  memoryEnabled?: boolean;
  memorySummaryCount?: number;
}

// Helper function to track usage in database
async function trackUsage(
  userId: string, 
  sessionId: string | undefined,
  model: string, 
  promptTokens: number, 
  completionTokens: number,
  modelPricing: { prompt: number; completion: number }
) {
  const supabase = await createClient()
  
  const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt
  const completionCost = (completionTokens / 1_000_000) * modelPricing.completion
  const totalCost = promptCost + completionCost
  
  // Record the usage using new schema structure
  await supabase.from('user_usage').insert({
    user_id: userId,
    endpoint: '/api/chat',
    model,
    token_count: promptTokens + completionTokens,
    metadata: {
      session_id: sessionId || null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      prompt_cost: promptCost,
      completion_cost: completionCost,
      total_cost: totalCost,
      model_pricing: modelPricing
    }
  })
  
  // Update user credits using correct column names
  try {
    const { data: credits } = await supabase
      .from('user_credits')
      .select('used_credits')
      .eq('user_id', userId)
      .single()
    
    if (credits) {
      await supabase
        .from('user_credits')
        .update({ used_credits: credits.used_credits + totalCost })
        .eq('user_id', userId)
    }
  } catch (error) {
    logger.error('Failed to update user credits:', error)
    // Don't fail the request if credit update fails
  }
}

// Core handler function
async function handleChatRequest(request: NextRequest, validatedData: ChatRequestData): Promise<NextResponse> {
  try {
    const { 
      messages, 
      model, 
      stream = true, 
      options = {}, 
      tone = "match-user", 
      sessionId,
      memoryEnabled = true,
      memorySummaryCount = 3
    } = validatedData;

    // Get authenticated user and their learning preferences
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Check credit limits if user is authenticated
    if (user) {
      // Get user credits
      const { data: credits } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (credits) {
        const remainingCredits = credits.total_credits - credits.used_credits
        if (remainingCredits <= 0) {
          return NextResponse.json(
            { 
              error: 'Credit limit exceeded (£1.00 limit reached). Billing system coming soon!',
              code: 'CREDIT_LIMIT_EXCEEDED',
              billingNotice: 'We are currently working on our billing system. For now, users have a £1.00 monthly limit.'
            },
            { status: 402 } // Payment Required
          )
        }
        
        // Warn if running low on credits (less than 10% remaining)
        if (remainingCredits < credits.total_credits * 0.1) {
          console.warn(`User ${user.id} running low on credits: ${remainingCredits} pence remaining out of £${(credits.total_credits / 100).toFixed(2)}`)
        }
      }
    }
    
    let learningPreferences: import('@/lib/learning-preferences').LearningPreference[] = []
    if (user) {
      try {
        learningPreferences = await getUserLearningPreferences(user.id)
        logger.dev.log('🧠 Chat API: Loaded learning preferences for user:', user.id, 'Count:', learningPreferences.length)
        if (learningPreferences.length > 0) {
          logger.dev.log('🎯 Learning preferences loaded:', learningPreferences.map(p => `${p.category}/${p.preference_key} (${p.weight})`))
        }
      } catch (error) {
        console.warn('Failed to fetch learning preferences:', error)
        // Continue without preferences rather than fail the chat
      }
    }

    // Fetch memory context from previous conversations if user is authenticated and memory is enabled
    let memoryContext = ''
    if (user && memoryEnabled) {
      try {
        const memoryResponse = await fetch(`${request.url.split('/api/chat')[0]}/api/memory-context?limit=${memorySummaryCount}`, {
          method: 'GET',
          headers: {
            'Cookie': request.headers.get('Cookie') || '', // Forward auth cookies
          },
        })

        if (memoryResponse.ok) {
          const memoryData = await memoryResponse.json()
          if (memoryData.summaries && memoryData.summaries.length > 0) {
            const memoryParts = memoryData.summaries.map((summary: { summary: string; key_topics: string[] }, index: number) => {
              const topics = Array.isArray(summary.key_topics) ? summary.key_topics.join(', ') : 'general conversation'
              return `Previous Conversation ${index + 1}:
Summary: ${summary.summary}
Topics: ${topics}`
            }).join('\n\n')

            memoryContext = `CONVERSATION MEMORY:
${memoryParts}

---

`
          }
        }
      } catch (error) {
        logger.dev.log('Failed to fetch memory context:', error)
        // Continue without memory context rather than fail the chat
      }
    }

    // Create personalized system prompt that incorporates user preferences and memory
    const baseSystemPrompt = createPersonalizedSystemPrompt(learningPreferences, tone);
    const systemPrompt = memoryContext + baseSystemPrompt;
    logger.dev.log('📝 Chat API: System prompt length:', systemPrompt.length, 'characters');
    if (memoryContext) {
      logger.dev.log('🧠 Chat API: Memory context injected with', memoryContext.split('Previous Conversation').length - 1, 'summaries');
    }

    // Sanitize messages content and ensure proper format
    const sanitizedMessages = [
      {
        id: 'system-prompt',
        role: 'system' as const,
        content: systemPrompt,
        timestamp: new Date()
      },
      ...messages.map((message, index) => {
        const sanitized = {
          id: `msg-${index}`, // Add required id field
          role: message.role as 'user' | 'assistant' | 'system',
          content: InputValidation.sanitizeInput(message.content),
          timestamp: new Date(), // Add required timestamp field
          attachments: message.attachments // Preserve attachments for vision models
        };
        
        // Debug logging for attachments
        if (message.attachments && message.attachments.length > 0) {
          logger.dev.log(`📎 Chat API: Message ${index} has ${message.attachments.length} attachments:`, 
            message.attachments.map(a => ({ name: a.file_name, type: a.mime_type, hasUrl: !!a.url }))
          );
        }
        
        return sanitized;
      })
    ];

    const apiKey = process.env.OPENROUTER_API_KEY!; // API key validated by middleware

    const client = new OpenRouterClient(apiKey)

    if (stream) {
      // Return streaming response
      const encoder = new TextEncoder()
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let completionTokens = 0;
            
            // Debug logging before sending to OpenRouter
            const messagesWithAttachments = sanitizedMessages.filter(msg => 'attachments' in msg && msg.attachments && msg.attachments.length > 0);
            if (messagesWithAttachments.length > 0) {
              logger.dev.log(`🔍 Chat API: About to send ${messagesWithAttachments.length} messages with attachments to OpenRouter`);
            }
            
            for await (const chunk of client.streamChat(sanitizedMessages, model, options)) {
              const processedChunk = tone === "duck" ? convertToDuckSpeak(chunk) : chunk;
              const data = `data: ${JSON.stringify({ content: processedChunk })}\n\n`
              controller.enqueue(encoder.encode(data))
              
              // Count tokens for usage tracking
              completionTokens += Math.ceil(chunk.length / 4); // Rough token approximation
            }
            
            // Estimate prompt tokens (rough approximation: 1 token ≈ 4 characters)
            const promptText = sanitizedMessages.map(m => m.content).join(' ');
            const promptTokens = Math.ceil(promptText.length / 4);
            
            // Track usage if user is authenticated
            if (user && user.id) {
              try {
                // Get model pricing from OpenRouter
                const models = await client.getModels();
                const currentModel = models.find(m => m.id === model);
                const modelPricing = {
                  prompt: currentModel?.pricing?.prompt || 0.0001,
                  completion: currentModel?.pricing?.completion || 0.0002
                };
                
                await trackUsage(user.id, sessionId, model, promptTokens, completionTokens, modelPricing);
              } catch (error) {
                logger.error('Failed to track usage:', error);
                // Don't fail the request if usage tracking fails
              }
            }
            
            // Log API usage for monitoring
            SecurityAudit.logApiUsage('/api/chat', model, promptTokens + completionTokens, request);
            
            // Send completion signal
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            logger.error('Streaming error:', error)
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
      
      // Track usage if user is authenticated
      if (user && user.id) {
        try {
          // Estimate tokens
          const promptText = sanitizedMessages.map(m => m.content).join(' ');
          const promptTokens = Math.ceil(promptText.length / 4);
          const completionTokens = Math.ceil(response.length / 4);
          
          // Get model pricing
          const models = await client.getModels();
          const currentModel = models.find(m => m.id === model);
          const modelPricing = {
            prompt: currentModel?.pricing?.prompt || 0.0001,
            completion: currentModel?.pricing?.completion || 0.0002
          };
          
          await trackUsage(user.id, sessionId, model, promptTokens, completionTokens, modelPricing);
        } catch (error) {
          logger.error('Failed to track usage:', error);
          // Don't fail the request if usage tracking fails
        }
      }
      
      // Log API usage for monitoring
      SecurityAudit.logApiUsage('/api/chat', model, response.length, request);
      
      return NextResponse.json({ content: processedResponse })
    }
  } catch (error) {
    logger.error('Chat API error:', error)
    
    // Log error for monitoring
    logger.error('Chat API error details:', {
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