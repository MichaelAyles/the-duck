import { NextResponse } from 'next/server'
import { Message } from '@/types/chat'
import { createClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'

// Helper function to create a fallback summary
function createFallbackSummary(messages: Message[]) {
  const userMessages = messages.filter(msg => msg.role === 'user')
  const assistantMessages = messages.filter(msg => msg.role === 'assistant')
  
  // Extract basic topics from user messages
  const keyTopics = userMessages
    .slice(0, 3) // Take first 3 user messages
    .map(msg => msg.content.split(' ').slice(0, 3).join(' ')) // First 3 words
    .filter(topic => topic.length > 0)

  return {
    summary: `Conversation with ${userMessages.length} user messages and ${assistantMessages.length} responses. Topics discussed included general questions and assistance.`,
    keyTopics: keyTopics.length > 0 ? keyTopics : ['general chat'],
    userPreferences: {
      explicit: {},
      implicit: {
        writingStyle: {
          formality: 0.5,
          verbosity: 0.5,
          technicalLevel: 0.5,
          activeResponseLength: 0.5
        }
      }
    }
  }
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json()

    // Get authenticated user if we need to save the summary
    let userId: string | null = null
    if (sessionId) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (!authError && user) {
        userId = user.id
      }
    }

    // Check if OpenRouter API key is available
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn('OpenRouter API key not configured, using fallback summary')
      return NextResponse.json(createFallbackSummary(messages))
    }

    // Use OpenRouter's Gemini Flash model for cost-effective summarization
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
            content: `You are an AI assistant tasked with analyzing a chat conversation and providing:
1. A concise summary of the main points discussed
2. Key topics covered
3. Analysis of the user's writing style and preferences

Format your response as a JSON object with the following structure:
{
  "summary": "Brief summary of the conversation",
  "keyTopics": ["topic1", "topic2", ...],
  "userPreferences": {
    "explicit": {
      // Any explicit preferences mentioned by the user
    },
    "implicit": {
      "writingStyle": {
        "formality": 0.5, // 0 = casual, 1 = formal
        "verbosity": 0.5, // 0 = concise, 1 = detailed
        "technicalLevel": 0.5, // 0 = basic, 1 = technical
        "activeResponseLength": 0.5 // 0 = short, 1 = long
      }
    }
  }
}`
          },
          ...messages.map((msg: Message) => ({
            role: msg.role,
            content: msg.content
          }))
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
      }),
    })

    if (!response.ok) {
      console.warn(`OpenRouter API failed (${response.status}), using fallback summary`)
      return NextResponse.json(createFallbackSummary(messages))
    }

    const data = await response.json()
    const summaryText = data.choices[0]?.message?.content

    if (!summaryText) {
      console.warn('No summary content received, using fallback')
      return NextResponse.json(createFallbackSummary(messages))
    }

    try {
      // Clean the response by removing markdown code blocks if present
      let cleanedText = summaryText.trim()
      
      // Remove ```json and ``` markers if present
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      // Parse the cleaned JSON response
      const summary = JSON.parse(cleanedText)
      
      // Save summary to database if sessionId and userId are available
      if (sessionId && userId) {
        try {
          const supabase = await createClient()
          
          const summaryData = {
            id: nanoid(),
            session_id: sessionId,
            summary: summary.summary,
            key_topics: summary.keyTopics || [],
            user_preferences: summary.userPreferences || {},
            writing_style_analysis: summary.userPreferences?.implicit?.writingStyle || {},
          }

          const { error } = await supabase
            .from('chat_summaries')
            .upsert(summaryData, {
              onConflict: 'session_id',
              ignoreDuplicates: false,
            })

          if (error) {
            console.error('Failed to save chat summary to database:', error)
          } else {
            console.log(`✅ Saved chat summary for session: ${sessionId}`)
          }
        } catch (dbError) {
          console.error('Error saving summary to database:', dbError)
        }
      }
      
      return NextResponse.json(summary)
    } catch (parseError) {
      console.warn('Failed to parse summary JSON, using fallback:', parseError)
      console.warn('Raw response was:', summaryText)
      return NextResponse.json(createFallbackSummary(messages))
    }

  } catch (error) {
    console.error('Error in summarize endpoint:', error)
    // Return fallback summary instead of error
    const { messages } = await req.json().catch(() => ({ messages: [] }))
    return NextResponse.json(createFallbackSummary(messages))
  }
} 