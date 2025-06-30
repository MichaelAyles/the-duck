import { NextRequest, NextResponse } from 'next/server'
import { Message } from '@/types/chat'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * 🏷️ Chat Title Generation API
 * 
 * Generates short, meaningful titles for chat conversations using Gemini Flash Lite
 * Triggered on up/down voting or when a chat needs a title
 */

function createFallbackTitle(messages: Message[]): string {
  // Filter out system messages and find the first user message
  const userMessages = messages.filter(msg => 
    msg.role === 'user' && 
    msg.content && 
    msg.content.trim().length > 0 &&
    msg.id !== "welcome-message"
  )
  
  if (userMessages.length === 0) {
    // If no user messages, try to find any non-system message
    const nonSystemMessages = messages.filter(msg => 
      msg.role !== 'system' && 
      msg.content && 
      msg.content.trim().length > 0 &&
      msg.id !== "welcome-message"
    )
    
    if (nonSystemMessages.length === 0) return 'New Chat'
    
    // Use the first non-system message as fallback with smarter extraction
    const firstMessage = nonSystemMessages[0]
    return extractSmartTitle(firstMessage.content)
  }
  
  // Use the first user message with smarter title extraction
  const firstUserMessage = userMessages[0]
  return extractSmartTitle(firstUserMessage.content)
}

function extractSmartTitle(content: string): string {
  const text = content.trim()
  
  // Try to extract meaningful keywords and create a better title
  const words = text.split(/\s+/)
  
  // Look for question words and key topics
  const questionWords = ['how', 'what', 'why', 'when', 'where', 'who', 'which']
  const actionWords = ['create', 'build', 'make', 'write', 'develop', 'implement', 'fix', 'solve', 'explain']
  const techWords = ['react', 'python', 'javascript', 'typescript', 'node', 'api', 'database', 'css', 'html']
  
  // Filter out common stop words but keep important ones
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']
  
  // Get important words (prioritize tech terms, action words, and capitalized words)
  const importantWords = words.filter((word, index) => {
    const lowerWord = word.toLowerCase()
    
    // Always include if it's a tech term or action word
    if (techWords.includes(lowerWord) || actionWords.includes(lowerWord)) return true
    
    // Include question words if they're at the beginning
    if (index < 3 && questionWords.includes(lowerWord)) return true
    
    // Include capitalized words (likely proper nouns/important terms)
    if (word[0] && word[0] === word[0].toUpperCase() && word.length > 2) return true
    
    // Include if not a stop word and has reasonable length
    if (!stopWords.includes(lowerWord) && word.length > 2) return true
    
    return false
  })
  
  // Take up to 5 important words, or fall back to first 6 words if no important ones found
  const titleWords = importantWords.length > 0 
    ? importantWords.slice(0, 5)
    : words.slice(0, 6)
  
  let title = titleWords.join(' ')
  
  // Clean up the title
  title = title
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
  
  // Truncate if too long
  if (title.length > 40) {
    title = title.slice(0, 37) + '...'
  }
  
  return title || 'New Chat'
}

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionId, preserveExistingOnFailure = false } = await req.json()

    // Get authenticated user if we need to save the title
    let userId: string | null = null
    if (sessionId) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (!authError && user) {
        userId = user.id
      }
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    let generatedTitle = createFallbackTitle(messages)
    let method = 'fallback'

    // Check if OpenRouter API key is available
    if (process.env.OPENROUTER_API_KEY) {
      if (process.env.NODE_ENV === 'development') {
        logger.dev.log('🔑 OpenRouter API key found, attempting AI title generation')
      }
      try {
        // Clean the API key (remove surrounding quotes if present)
        const cleanApiKey = process.env.OPENROUTER_API_KEY.replace(/^["']|["']$/g, '')
        
        // Use ALL messages for comprehensive title generation
        const relevantMessages = messages.filter(msg => 
          msg.content && 
          msg.content.trim().length > 0 &&
          msg.id !== "welcome-message"
        )
        
        if (process.env.NODE_ENV === 'development') {
          logger.dev.log('📝 Sending messages to OpenRouter for title generation:', {
            messageCount: relevantMessages.length,
            totalChars: relevantMessages.reduce((acc, msg) => acc + msg.content.length, 0),
            preview: relevantMessages.slice(0, 2).map(m => ({ role: m.role, preview: m.content.slice(0, 50) + '...' }))
          })
        }

        // Use Gemini Flash 2.5 for high-quality, fast title generation
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite-preview-06-17',
            messages: [
              {
                role: 'system',
                content: `Create a short descriptive title for this conversation. Read all messages and identify the main topic.

Guidelines:
- 2-5 words maximum
- Use key terms from the conversation
- Be specific about the topic
- Use title case
- No quotes or punctuation

Examples: "React Component Guide", "Python Data Analysis", "CSS Animation Tutorial"

Return only the title.`
              },
              ...relevantMessages.map((msg: Message) => ({
                role: msg.role === 'system' ? 'assistant' : msg.role,
                content: msg.content // Use full content for better context
              }))
            ],
            temperature: 0.1, // Very low temperature for consistent, focused titles
            max_tokens: 30, // Enough for 6 words max
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (process.env.NODE_ENV === 'development') {
            logger.dev.log('🤖 OpenRouter API response:', JSON.stringify(data, null, 2))
          }
          
          // Check for successful response with content
          if (!data.error && data.choices?.[0]?.message?.content && data.choices[0].message.content.trim().length > 0) {
            let aiTitle = data.choices[0].message.content.trim()
            if (process.env.NODE_ENV === 'development') {
              logger.dev.log('🤖 Raw AI title:', aiTitle)
            }
            
            // Clean up the generated title
            aiTitle = aiTitle
              .replace(/['"]/g, '') // Remove quotes
              .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
              .trim()

            if (process.env.NODE_ENV === 'development') {
              logger.dev.log('🤖 Cleaned AI title:', aiTitle)
            }

            // Ensure title isn't too long
            if (aiTitle.length > 40) {
              aiTitle = aiTitle.slice(0, 37) + '...'
            }

            // Use AI title if it's good quality
            if (aiTitle.length >= 3) {
              generatedTitle = aiTitle
              method = 'ai-generated'
              if (process.env.NODE_ENV === 'development') {
                logger.dev.log('✅ Using AI-generated title:', aiTitle)
              }
            } else {
              if (process.env.NODE_ENV === 'development') {
                logger.dev.log('❌ AI title too short, using fallback')
              }
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              logger.dev.log('❌ No valid content in AI response, trying fallback model:', data)
            }
            
            // Try with a different model if the first one fails
            try {
              const fallbackResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${cleanApiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                },
                body: JSON.stringify({
                  model: 'openai/gpt-4o-mini', // Reliable fallback
                  messages: [
                    {
                      role: 'system',
                      content: 'Create a 2-5 word title for this conversation. Use the main topic discussed. Return only the title.'
                    },
                    ...relevantMessages.map((msg: Message) => ({
                      role: msg.role === 'system' ? 'assistant' : msg.role,
                      content: msg.content
                    }))
                  ],
                  temperature: 0.1,
                  max_tokens: 20,
                }),
              })
              
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json()
                if (fallbackData.choices?.[0]?.message?.content?.trim()) {
                  let fallbackTitle = fallbackData.choices[0].message.content.trim()
                  fallbackTitle = fallbackTitle.replace(/[\"']/g, '').trim()
                  
                  if (fallbackTitle.length >= 3 && fallbackTitle.length <= 50) {
                    generatedTitle = fallbackTitle
                    method = 'ai-generated-fallback'
                    if (process.env.NODE_ENV === 'development') {
                      logger.dev.log('✅ Using fallback AI-generated title:', fallbackTitle)
                    }
                  }
                }
              }
            } catch (fallbackError) {
              if (process.env.NODE_ENV === 'development') {
                logger.dev.log('❌ Fallback model also failed:', fallbackError)
              }
            }
          }
        } else {
          const errorText = await response.text()
          logger.error('❌ OpenRouter API HTTP error:', response.status, response.statusText, errorText)
        }
      } catch (apiError) {
        logger.error('OpenRouter API error:', apiError)
        // Continue with fallback title
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        logger.dev.log('🔑 No OpenRouter API key found, using fallback title generation')
      }
    }

    // Handle database operations only if we have a user and sessionId
    let updateSuccessful = true;
    let existingTitle = 'New Chat';
    
    if (userId && sessionId) {
      const supabase = await createClient()
      
      // Verify user owns the session by querying database directly
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('title')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single()

      if (sessionError || !session) {
        console.warn('Chat session not found or access denied, continuing without database update')
        updateSuccessful = false;
      } else {
        existingTitle = session.title || 'New Chat'
        
        // If AI generation fails and we should preserve existing title, use existing title
        if (method === 'fallback' && preserveExistingOnFailure && existingTitle !== 'New Chat') {
          generatedTitle = existingTitle
          method = 'preserved'
        }

        // Update the session with the new title (only if it changed)
        if (method === 'preserved' && generatedTitle === existingTitle) {
          // Title was preserved and unchanged, skip database update
          if (process.env.NODE_ENV === 'development') {
            logger.dev.log('Title preserved - skipping database update');
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            logger.dev.log(`🔄 Updating session ${sessionId} with title: "${generatedTitle}"`)
          }
          
          // Update the session title directly in database
          const { error: updateError } = await supabase
            .from('chat_sessions')
            .update({ title: generatedTitle })
            .eq('id', sessionId)
            .eq('user_id', userId)
          
          if (updateError) {
            logger.error(`❌ Failed to update session title:`, updateError)
            updateSuccessful = false;
          } else if (process.env.NODE_ENV === 'development') {
            logger.dev.log(`✅ Successfully updated session title in database: ${generatedTitle}`)
          }
        }
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        logger.dev.log('No user authentication or sessionId provided, skipping database operations')
      }
      updateSuccessful = false; // No database update attempted
    }

    if (process.env.NODE_ENV === 'development') {
      logger.dev.log(`✅ Generated title: ${generatedTitle} (method: ${method})`)
    }

    return NextResponse.json({
      title: generatedTitle,
      method,
      sessionId,
      updated: updateSuccessful
    })

  } catch (error) {
    logger.error('Title generation error:', error)
    
    // Always return a fallback title
    const { messages } = await req.json().catch(() => ({ messages: [] }))
    
    return NextResponse.json({
      title: createFallbackTitle(messages || []),
      method: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}