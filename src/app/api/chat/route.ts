import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter'
import { ChatMessage } from '@/types/chat'

// Helper function to convert text to duck speak
function convertToDuckSpeak(text: string): string {
  // Replace each word with "quack" while preserving punctuation and spacing
  return text.replace(/\b\w+\b/g, 'quack');
}

export async function POST(request: NextRequest) {
  try {
    const { messages, model, stream = true, options = {}, tone = "match-user" } = await request.json()

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
              const processedChunk = tone === "duck" ? convertToDuckSpeak(chunk) : chunk;
              const data = `data: ${JSON.stringify({ content: processedChunk })}\n\n`
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
      const processedResponse = tone === "duck" ? convertToDuckSpeak(response) : response;
      return NextResponse.json({ content: processedResponse })
    }
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}