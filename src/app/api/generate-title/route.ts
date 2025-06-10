import { NextResponse } from 'next/server'
import { Message } from '@/components/chat/chat-interface'
import { SupabaseDatabaseService } from '@/lib/db/supabase-operations'
import { createClient } from '@supabase/supabase-js'

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

export async function POST(req: Request) {
  try {
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

    // Get user from auth for database operations
    const authHeader = req.headers.get('authorization')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {}
        }
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

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

    // Update the chat session with the new title if we have a user
    if (user) {
      try {
        // Get the existing session to preserve other data
        const existingSession = await SupabaseDatabaseService.getChatSession(sessionId, user.id)
        
        if (existingSession) {
          // Update the session with the new title
          await SupabaseDatabaseService.saveChatSession(
            sessionId,
            generatedTitle,
            existingSession.messages as any,
            existingSession.model,
            user.id
          )
        }
      } catch (dbError) {
        console.error('Error updating session title in database:', dbError)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      title: generatedTitle,
      method,
      sessionId,
      updated: !!user // Indicate if we updated the database
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