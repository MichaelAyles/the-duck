import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter'
import { 
  searchModels,
  getRecommendedModels,
  getUserPreferences,
  DEFAULT_USER_PREFERENCES 
} from '@/lib/db/supabase-operations'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'

async function handleSearchModelsRequest(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const provider = searchParams.get('provider') || undefined
    const minContextLength = searchParams.get('min_context') ? parseInt(searchParams.get('min_context')!) : undefined
    const maxCostPerToken = searchParams.get('max_cost') ? parseFloat(searchParams.get('max_cost')!) : undefined
    const includeFreeTier = searchParams.get('include_free') === 'true' ? true : 
                           searchParams.get('include_free') === 'false' ? false : undefined
    const getRecommended = searchParams.get('recommended') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'OpenRouter API key not configured',
          details: 'OPENROUTER_API_KEY environment variable is required to search models'
        },
        { status: 500 }
      )
    }

    // Fetch all models from OpenRouter
    const client = new OpenRouterClient(apiKey)
    const allModels = await client.getModels()
    
    // Get user preferences for personalization
    let userPreferences = DEFAULT_USER_PREFERENCES
    try {
      const mockUserId = 'mock-user-id' // In production, get from auth
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        userPreferences = await getUserPreferences(mockUserId)
      }
    } catch (error) {
      console.warn('Could not fetch user preferences, using defaults:', error)
    }

    let results: any[]

    if (getRecommended) {
      // Get personalized recommendations
      const mockUserId = 'mock-user-id'
      results = await getRecommendedModels(mockUserId, allModels, limit)
    } else {
      // Perform parametric search
      results = searchModels(allModels, query, {
        provider,
        minContextLength,
        maxCostPerToken,
        includeFreeTier
      })
    }

    // Add starred status and provider info
    const modelsWithMeta = results.map(model => ({
      ...model,
      provider: model.id.split('/')[0],
      starred: userPreferences.starredModels.includes(model.id),
      isPrimary: model.id === userPreferences.primaryModel
    })).slice(0, limit)

    return NextResponse.json({ 
      models: modelsWithMeta,
      total: results.length,
      query,
      filters: {
        provider,
        minContextLength,
        maxCostPerToken,
        includeFreeTier
      },
      userPreferences: {
        starredModels: userPreferences.starredModels,
        primaryModel: userPreferences.primaryModel
      }
    })
  } catch (error) {
    console.error('Search models API error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to search models'
      },
      { status: 500 }
    )
  }
}

// Apply security middleware
export const GET = withSecurity(
  withRateLimit(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.API)(
    handleSearchModelsRequest
  )
) 