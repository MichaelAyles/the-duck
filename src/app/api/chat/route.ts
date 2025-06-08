import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter'
import { ChatMessage } from '@/types/chat'

export async function POST(request: NextRequest) {
  try {
    const { messages, model, stream = true, options = {} } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    if (!model) {
      return NextResponse.json(
        { error: 'Model is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const client = new OpenRouterClient(apiKey)

    if (stream) {
      // Return streaming response
      const encoder = new TextEncoder()
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of client.streamChat(messages, model, options)) {
              const data = `data: ${JSON.stringify({ content: chunk })}\n\n`
              controller.enqueue(encoder.encode(data))
            }
            
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

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      // Return non-streaming response
      const response = await client.chat(messages, model, options)
      return NextResponse.json({ content: response })
    }
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}