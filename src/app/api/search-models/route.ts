import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter'
import { 
  getUserPreferences,
  DEFAULT_USER_PREFERENCES
} from '@/lib/db/server-operations'
import {
  searchModels,
  getRecommendedModels
} from '@/lib/db/supabase-operations'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'
import { getUserId } from '@/lib/auth'

async function handleSearchModelsRequest(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const provider = searchParams.get('provider') || undefined
    const minContextLength = searchParams.get('min_context') ? parseInt(searchParams.get('min_context')!) : undefined
    const maxCostPerToken = searchParams.get('max_cost') ? parseFloat(searchParams.get('max_cost')!) : undefined
    const includeFreeTier = searchParams.get('include_free') ? searchParams.get('include_free') === 'true' : undefined
    const getRecommended = searchParams.get('recommended') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    // Fetch all models from OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'OpenRouter API key not configured',
          details: 'OPENROUTER_API_KEY environment variable is required'
        },
        { status: 500 }
      )
    }

    const client = new OpenRouterClient(apiKey)
    const allModels = await client.getModels()

    // Get user preferences with fallback to defaults
    let userPreferences = DEFAULT_USER_PREFERENCES
    try {
      const userId = await getUserId(request)
      if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        userPreferences = await getUserPreferences(userId)
      }
    } catch (error) {
      console.warn('Could not fetch user preferences, using defaults:', error)
    }

    let results: any[]

    if (getRecommended) {
      // Get personalized recommendations
      const userId = await getUserId(request)
      if (userId) {
        results = await getRecommendedModels(userId, allModels, limit)
      } else {
        // If not authenticated, just return top models
        results = allModels.slice(0, limit)
      }
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