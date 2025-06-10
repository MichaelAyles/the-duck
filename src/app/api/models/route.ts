import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient, CURATED_MODELS } from '@/lib/openrouter'
import { 
  getUserPreferences,
  DEFAULT_USER_PREFERENCES,
  getTop5Models 
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

    // Fetch all available models from OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'OpenRouter API key not configured',
          details: 'OPENROUTER_API_KEY environment variable is required to fetch models'
        },
        { status: 500 }
      )
    }

    const client = new OpenRouterClient(apiKey)
    const allModels = await client.getModels()
    
    // Get user preferences for primary model info
    let primaryModel = starredModels[0] || DEFAULT_USER_PREFERENCES.primaryModel
    if (includeStarred) {
      try {
        const mockUserId = 'mock-user-id'
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          const preferences = await getUserPreferences(mockUserId)
          primaryModel = preferences.primaryModel
        }
      } catch (error) {
        console.warn('Could not fetch primary model, using default:', error)
      }
    }

    // Add starred status, primary status, and provider info to all models
    const modelsWithMeta = allModels.map(model => ({
      ...model,
      provider: model.id.split('/')[0], // Extract provider from model ID
      starred: includeStarred ? starredModels.includes(model.id) : false,
      isPrimary: includeStarred ? model.id === primaryModel : false
    }))

    if (type === 'curated') {
      // For curated, show only starred models (or top 5 if user has no starred models)
      const userStarredModels = starredModels.length > 0 ? starredModels : getTop5Models(allModels)
      const curatedModels = modelsWithMeta.filter(model => userStarredModels.includes(model.id))
      
      return NextResponse.json({ 
        models: curatedModels,
        starredModels: includeStarred ? starredModels : undefined,
        primaryModel: includeStarred ? primaryModel : undefined,
        totalAvailable: allModels.length
      })
    }

    if (type === 'all') {
      // Return all models with starred status
      return NextResponse.json({ 
        models: modelsWithMeta,
        starredModels: includeStarred ? starredModels : undefined,
        primaryModel: includeStarred ? primaryModel : undefined,
        totalAvailable: allModels.length,
        top5: getTop5Models(allModels)
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