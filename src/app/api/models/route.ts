import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient, CURATED_MODELS } from '@/lib/openrouter'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'curated'

    if (type === 'curated') {
      // Return curated models for the dropdown
      return NextResponse.json({ models: CURATED_MODELS })
    }

    if (type === 'all') {
      // Fetch all available models from OpenRouter
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        return NextResponse.json(
          { error: 'OpenRouter API key not configured' },
          { status: 500 }
        )
      }

      const client = new OpenRouterClient(apiKey)
      const models = await client.getModels()
      
      return NextResponse.json({ models })
    }

    return NextResponse.json(
      { error: 'Invalid type parameter. Use "curated" or "all"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Models API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}