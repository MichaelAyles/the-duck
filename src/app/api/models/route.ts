import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient, CURATED_MODELS } from '@/lib/openrouter'
import { 
  getUserPreferences,
  DEFAULT_USER_PREFERENCES 
} from '@/lib/db/supabase-operations'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'

async function handleModelsRequest(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'curated'
    const includeStarred = searchParams.get('include_starred') === 'true'

    // Get user's starred models if requested
    let starredModels: string[] = DEFAULT_USER_PREFERENCES.starredModels
    if (includeStarred) {
      try {
        const mockUserId = 'mock-user-id' // In production, get from auth
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          const preferences = await getUserPreferences(mockUserId)
          starredModels = preferences.starredModels
        }
      } catch (error) {
        console.warn('Could not fetch starred models, using defaults:', error)
      }
    }

    if (type === 'curated') {
      // Return curated models for the dropdown with starred status
      const modelsWithStarred = CURATED_MODELS.map(model => ({
        ...model,
        starred: includeStarred ? starredModels.includes(model.id) : model.starred
      }))
      
      return NextResponse.json({ 
        models: modelsWithStarred,
        starredModels: includeStarred ? starredModels : undefined
      })
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
      
      // Add starred status to all models
      const modelsWithStarred = models.map(model => ({
        ...model,
        starred: includeStarred ? starredModels.includes(model.id) : false
      }))
      
      return NextResponse.json({ 
        models: modelsWithStarred,
        starredModels: includeStarred ? starredModels : undefined
      })
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

// Apply security middleware
export const GET = withSecurity(
  withRateLimit(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.MODELS)(
    handleModelsRequest
  )
);