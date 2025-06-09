import { NextResponse } from 'next/server'
import { Message } from '@/components/chat/chat-interface'

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    // Use OpenRouter's Gemini Flash model for cost-effective summarization
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash',
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
        "formality": 0-1, // 0 = casual, 1 = formal
        "verbosity": 0-1, // 0 = concise, 1 = detailed
        "technicalLevel": 0-1, // 0 = basic, 1 = technical
        "preferredResponseLength": 0-1 // 0 = short, 1 = long
      }
    }
  }
}`
          },
          ...messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get summary from OpenRouter')
    }

    const data = await response.json()
    const summaryText = data.choices[0].message.content

    // Parse the JSON response
    const summary = JSON.parse(summaryText)

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error in summarize endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to summarize chat' },
      { status: 500 }
    )
  }
} 