import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter'
import { 
  getUserPreferences,
  DEFAULT_USER_PREFERENCES
} from '@/lib/db/server-operations'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'
import { getUserId } from '@/lib/auth'

// Move getTop5Models function here since it's just a utility function
interface ModelData {
  id: string
  total_rank?: number
  last_week_rank?: number
}

function getTop5Models(allModels: ModelData[]): string[] {
  if (!Array.isArray(allModels) || allModels.length === 0) {
    return []
  }
  
  return allModels
    .sort((a, b) => {
      // Sort by total_rank (lower is better), then by last_week_rank
      const aRank = a.total_rank || 999999
      const bRank = b.total_rank || 999999
      
      if (aRank !== bRank) {
        return aRank - bRank
      }
      
      // If total_rank is the same, sort by last_week_rank
      const aWeekRank = a.last_week_rank || 999999
      const bWeekRank = b.last_week_rank || 999999
      return aWeekRank - bWeekRank
    })
    .slice(0, 5)
    .map(model => model.id)
}

async function handleModelsRequest(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'curated'
    const includeStarred = searchParams.get('include_starred') === 'true'

    // Get user's starred models if requested
    let starredModels: string[] = DEFAULT_USER_PREFERENCES.starredModels
    if (includeStarred) {
      try {
        const userId = await getUserId(request)
        if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
          const preferences = await getUserPreferences(userId)
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
        const userId = await getUserId(request)
        if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
          const preferences = await getUserPreferences(userId)
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
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to fetch models from OpenRouter'
      },
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