import { NextRequest, NextResponse } from 'next/server'
import { Message } from '@/components/chat/chat-interface'
import { createClient } from '@/lib/supabase/server'

/**
 * 🏷️ Chat Title Generation API
 * 
 * Generates short, meaningful titles for chat conversations using Gemini Flash Lite
 * Triggered on up/down voting or when a chat needs a title
 */

function createFallbackTitle(messages: Message[]): string {
  // Extract first user message and create a simple title
  const firstUserMessage = messages.find(msg => msg.role === 'user')
  if (!firstUserMessage) return 'New Chat'
  
  // Get first few words and clean them up
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
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { messages, sessionId } = await req.json()

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
      try {
        // Get the first few messages to generate a title (don't need entire conversation)
        const relevantMessages = messages.slice(0, 6) // First 6 messages should be enough

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
            max_tokens: 20, // Short titles only
          }),
        })

        if (response.ok) {
          const data = await response.json()
          
          if (!data.error && data.choices?.[0]?.message?.content) {
            let aiTitle = data.choices[0].message.content.trim()
            
            // Clean up the generated title
            aiTitle = aiTitle
              .replace(/['"]/g, '') // Remove quotes
              .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
              .trim()

            // Ensure title isn't too long
            if (aiTitle.length > 40) {
              aiTitle = aiTitle.slice(0, 37) + '...'
            }

            // Use AI title if it's good quality
            if (aiTitle.length >= 3) {
              generatedTitle = aiTitle
              method = 'ai-generated'
            }
          }
        }
      } catch (apiError) {
        console.error('OpenRouter API error:', apiError)
        // Continue with fallback title
      }
    }

    // Verify user owns the session by fetching it first
    const sessionResponse = await fetch(new URL(`/api/sessions/${sessionId}`, req.url).toString(), {
      method: 'GET',
      headers: {
        'Cookie': req.headers.get('cookie') || '',
      },
    })

    if (!sessionResponse.ok) {
      if (sessionResponse.status === 404) {
        return NextResponse.json({ error: 'Chat session not found or access denied' }, { status: 404 })
      }
      throw new Error('Failed to fetch session')
    }

    await sessionResponse.json()
    // Session exists, we can proceed with title generation

    console.log(`✅ Generated title for session ${sessionId}: ${generatedTitle}`)

    // Update the session with the new title
    const updateResponse = await fetch(new URL(`/api/sessions/${sessionId}`, req.url).toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        title: generatedTitle,
      }),
    })

    if (!updateResponse.ok) {
      console.error('Failed to update session title')
    }

    return NextResponse.json({
      title: generatedTitle,
      method,
      sessionId,
      updated: updateResponse.ok
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