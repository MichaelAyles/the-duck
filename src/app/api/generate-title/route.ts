import { NextRequest, NextResponse } from 'next/server'
import { Message } from '@/types/chat'
import { createClient } from '@/lib/supabase/server'

/**
 * 🏷️ Chat Title Generation API
 * 
 * Generates short, meaningful titles for chat conversations using Gemini Flash Lite
 * Triggered on up/down voting or when a chat needs a title
 */

function createFallbackTitle(messages: Message[]): string {
  // Debug: Log all messages to see what we're working with
  console.error('🔍 DEBUG: createFallbackTitle called with messages:', messages.map(m => ({ role: m.role, content: m.content.slice(0, 50) + '...' })))
  
  // Extract first user message and create a simple title
  const firstUserMessage = messages.find(msg => msg.role === 'user')
  console.error('🔍 DEBUG: firstUserMessage found:', firstUserMessage ? { role: firstUserMessage.role, content: firstUserMessage.content.slice(0, 50) + '...' } : 'NONE')
  
  if (!firstUserMessage) return 'New Chat'
  
  // Get first few words and clean them up
  const words = firstUserMessage.content.trim().split(' ').slice(0, 4)
  let title = words.join(' ')
  
  // Truncate if too long
  if (title.length > 30) {
    title = title.slice(0, 27) + '...'
  }
  
  console.error('🔍 DEBUG: Generated fallback title:', title)
  return title || 'New Chat'
}

export async function POST(req: NextRequest) {
  try {
    console.error('🔍 DEBUG: Title generation API called')
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('🔍 DEBUG: Auth failed:', authError)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { messages, sessionId, preserveExistingOnFailure = false } = await req.json()
    console.error('🔍 DEBUG: Request data:', { 
      messagesCount: messages?.length, 
      sessionId, 
      preserveExistingOnFailure,
      firstMessage: messages?.[0] ? { role: messages[0].role, content: messages[0].content.slice(0, 50) + '...' } : 'NONE'
    })

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('🔍 DEBUG: No messages provided')
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    if (!sessionId) {
      console.error('🔍 DEBUG: No session ID provided')
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    let generatedTitle = createFallbackTitle(messages)
    let method = 'fallback'

    // Check if OpenRouter API key is available
    console.error('🔍 DEBUG: OpenRouter API key available:', !!process.env.OPENROUTER_API_KEY)
    if (process.env.OPENROUTER_API_KEY) {
      try {
        // Get the first few messages to generate a title (don't need entire conversation)
        const relevantMessages = messages.slice(0, 6) // First 6 messages should be enough
        if (process.env.NODE_ENV === 'development') {
          console.log('📝 Sending messages to OpenRouter:', relevantMessages.map(m => ({ role: m.role, content: m.content.slice(0, 50) + '...' })))
        }

        // Use Gemini Flash Lite for cost-effective title generation
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
                content: msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content
              }))
            ],
            temperature: 0.3, // Lower temperature for more consistent titles
            max_tokens: 40, // Allow for more descriptive titles
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (process.env.NODE_ENV === 'development') {
            console.log('🤖 OpenRouter API response:', JSON.stringify(data, null, 2))
          }
          
          if (!data.error && data.choices?.[0]?.message?.content) {
            let aiTitle = data.choices[0].message.content.trim()
            if (process.env.NODE_ENV === 'development') {
              console.log('🤖 Raw AI title:', aiTitle)
            }
            
            // Clean up the generated title
            aiTitle = aiTitle
              .replace(/['"]/g, '') // Remove quotes
              .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
              .trim()

            if (process.env.NODE_ENV === 'development') {
              console.log('🤖 Cleaned AI title:', aiTitle)
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
                console.log('✅ Using AI-generated title:', aiTitle)
              }
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.log('❌ AI title too short, using fallback')
              }
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('❌ No valid content in AI response:', data)
            }
          }
        } else {
          const errorText = await response.text()
          console.error('❌ OpenRouter API HTTP error:', response.status, response.statusText, errorText)
        }
      } catch (apiError) {
        console.error('OpenRouter API error:', apiError)
        // Continue with fallback title
      }
    }

    // Verify user owns the session by querying database directly
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('title')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Chat session not found or access denied' }, { status: 404 })
    }

    const existingTitle = session.title || 'New Chat'
    
    // If AI generation fails and we should preserve existing title, use existing title
    if (method === 'fallback' && preserveExistingOnFailure && existingTitle !== 'New Chat') {
      generatedTitle = existingTitle
      method = 'preserved'
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Generated title for session ${sessionId}: ${generatedTitle} (method: ${method})`)
    }

    // Update the session with the new title (only if it changed)
    let updateSuccessful = true;
    
    if (method === 'preserved' && generatedTitle === existingTitle) {
      // Title was preserved and unchanged, skip database update
      if (process.env.NODE_ENV === 'development') {
        console.log('Title preserved - skipping database update');
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Updating session ${sessionId} with title: "${generatedTitle}"`)
      }
      
      // Update the session title directly in database
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({ title: generatedTitle })
        .eq('id', sessionId)
        .eq('user_id', user.id)
      
      if (updateError) {
        console.error(`❌ Failed to update session title:`, updateError)
        updateSuccessful = false;
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Successfully updated session title in database: ${generatedTitle}`)
      }
    }

    return NextResponse.json({
      title: generatedTitle,
      method,
      sessionId,
      updated: updateSuccessful
    })

  } catch (error) {
    console.error('Title generation error:', error)
    
    // Always return a fallback title
    const { messages } = await req.json().catch(() => ({ messages: [] }))
    
    return NextResponse.json({
      title: createFallbackTitle(messages || []),
      method: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}