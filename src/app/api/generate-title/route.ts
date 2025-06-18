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
    
    // Use the first non-system message as fallback
    const firstMessage = nonSystemMessages[0]
    const words = firstMessage.content.trim().split(' ').slice(0, 4)
    let title = words.join(' ')
    
    if (title.length > 30) {
      title = title.slice(0, 27) + '...'
    }
    
    return title || 'New Chat'
  }
  
  // Use the first user message
  const firstUserMessage = userMessages[0]
  const words = firstUserMessage.content.trim().split(' ').slice(0, 4)
  let title = words.join(' ')
  
  // Truncate if too long
  if (title.length > 30) {
    title = title.slice(0, 27) + '...'
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
        
        // Use all messages for title generation (2.0 flash lite is very cheap)
        const relevantMessages = messages
        if (process.env.NODE_ENV === 'development') {
          logger.dev.log('📝 Sending messages to OpenRouter:', relevantMessages.length, 'messages')
        }

        // Use Gemini Flash Lite for cost-effective title generation
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-lite-001',
            messages: [
              {
                role: 'system',
                content: `You are a title generator. Create a short, descriptive title (2-5 words max) for this conversation. 

Rules:
- Maximum 5 words
- Be specific and descriptive
- Avoid generic words like "chat", "conversation", "help"
- Focus on the main topic or question
- Use title case
- No quotes or special characters
- Examples: "Python Data Analysis", "Recipe for Pasta", "React Hooks Guide", "Travel to Japan"

Respond with ONLY the title, nothing else.`
              },
              ...relevantMessages.map((msg: Message) => ({
                role: msg.role === 'system' ? 'assistant' : msg.role,
                content: msg.content // Use full content for better context
              }))
            ],
            temperature: 0.3, // Lower temperature for more consistent titles
            max_tokens: 40, // Allow for more descriptive titles
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (process.env.NODE_ENV === 'development') {
            logger.dev.log('🤖 OpenRouter API response:', JSON.stringify(data, null, 2))
          }
          
          if (!data.error && data.choices?.[0]?.message?.content) {
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
              logger.dev.log('❌ No valid content in AI response:', data)
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