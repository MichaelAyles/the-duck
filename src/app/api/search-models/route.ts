import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter'
import { DEFAULT_ACTIVE_MODELS } from '@/lib/config'
import { logger } from '@/lib/logger'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'

const DEFAULT_PRIMARY_MODEL = DEFAULT_ACTIVE_MODELS[0]

interface Model {
  id: string
  name: string
  description?: string
  context_length?: number
  pricing?: {
    prompt?: number
    completion?: number
  }
}

function searchModels(
  allModels: Model[], 
  searchQuery: string, 
  filters: {
    provider?: string
    minContextLength?: number
    maxCostPerToken?: number
    includeFreeTier?: boolean
    capabilities?: string[]
  } = {}
): Model[] {
  if (!allModels || allModels.length === 0) {
    return []
  }

  let filteredModels = allModels

  // Text search
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    filteredModels = filteredModels.filter((model) => 
      model.name.toLowerCase().includes(query) ||
      model.id.toLowerCase().includes(query) ||
      (model.description && model.description.toLowerCase().includes(query))
    )
  }

  // Provider filter
  if (filters.provider) {
    filteredModels = filteredModels.filter((model) => 
      model.id.startsWith(filters.provider + '/')
    )
  }

  // Context length filter
  if (filters.minContextLength !== undefined) {
    filteredModels = filteredModels.filter((model) => 
      (model.context_length || 0) >= filters.minContextLength!
    )
  }

  // Cost filter (approximate based on pricing structure)
  if (filters.maxCostPerToken !== undefined) {
    filteredModels = filteredModels.filter((model) => {
      if (!model.pricing) return true // Include models without pricing info
      const promptCost = model.pricing.prompt || 0
      const completionCost = model.pricing.completion || 0
      const avgCost = (promptCost + completionCost) / 2
      return avgCost <= filters.maxCostPerToken!
    })
  }

  // Free tier filter
  if (filters.includeFreeTier === false) {
    filteredModels = filteredModels.filter((model) => 
      !model.id.includes(':free') && 
      !(model.pricing?.prompt === 0 && model.pricing?.completion === 0)
    )
  } else if (filters.includeFreeTier === true) {
    // Only show free models
    filteredModels = filteredModels.filter((model) => 
      model.id.includes(':free') || 
      (model.pricing?.prompt === 0 && model.pricing?.completion === 0)
    )
  }

  // Sort by relevance and quality
  return filteredModels.sort((a, b) => {
    // Prioritize our curated top models
    const isACurated = DEFAULT_ACTIVE_MODELS.includes(a.id)
    const isBCurated = DEFAULT_ACTIVE_MODELS.includes(b.id)
    
    if (isACurated !== isBCurated) {
      return isACurated ? -1 : 1
    }

    // Then by context length (higher is better)
    const contextDiff = (b.context_length || 0) - (a.context_length || 0)
    if (contextDiff !== 0) {
      return contextDiff
    }

    // Then by provider ranking
    const providerScore = (model: Model) => {
      const provider = model.id.split('/')[0]
      const providerRanks: { [key: string]: number } = {
        'google': 10,
        'deepseek': 9,
        'anthropic': 8,
        'openai': 7,
        'meta-llama': 6,
        'mistralai': 5
      }
      return providerRanks[provider] || 0
    }
    
    const providerDiff = providerScore(b) - providerScore(a)
    if (providerDiff !== 0) {
      return providerDiff
    }

    // Finally alphabetically
    return a.name.localeCompare(b.name)
  })
}

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
    let userPreferences = {
      starredModels: [...DEFAULT_ACTIVE_MODELS],
      primaryModel: DEFAULT_PRIMARY_MODEL
    }
    
    try {
      // Try to get user preferences from the API
      const prefsResponse = await fetch(new URL('/api/user/preferences', request.url).toString(), {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('cookie') || '',
        },
      })

      if (prefsResponse.ok) {
        const prefsData = await prefsResponse.json()
        if (prefsData.preferences) {
          userPreferences = {
            starredModels: prefsData.preferences.starredModels || [...DEFAULT_ACTIVE_MODELS],
            primaryModel: prefsData.preferences.primaryModel || DEFAULT_PRIMARY_MODEL
          }
        }
      }
    } catch (error) {
      logger.warn('Could not fetch user preferences, using defaults:', error)
    }

    let results: Model[]

    if (getRecommended) {
      // Get personalized recommendations based on starred models
      const activeProviders = new Set(
        userPreferences.starredModels.map(id => id.split('/')[0])
      )
      
      // Prioritize models from same providers as starred models
      results = allModels.sort((a, b) => {
        const aStarred = userPreferences.starredModels.includes(a.id)
        const bStarred = userPreferences.starredModels.includes(b.id)
        
        if (aStarred !== bStarred) return aStarred ? -1 : 1
        
        const aActiveProvider = activeProviders.has(a.id.split('/')[0])
        const bActiveProvider = activeProviders.has(b.id.split('/')[0])
        
        if (aActiveProvider !== bActiveProvider) return aActiveProvider ? -1 : 1
        
        return 0
      })
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
    logger.error('Search models API error:', error)
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