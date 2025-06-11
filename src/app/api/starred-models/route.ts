import { NextRequest, NextResponse } from 'next/server'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'

const DEFAULT_STARRED_MODELS = [
  'google/gemini-2.5-flash-preview-05-20',
  'google/gemini-2.5-pro-preview-05-06',
  'deepseek/deepseek-chat-v3-0324',
  'anthropic/claude-sonnet-4',
  'openai/gpt-4o-mini'
]

const DEFAULT_PRIMARY_MODEL = DEFAULT_STARRED_MODELS[0]

async function handleStarredModelsGet(request: NextRequest): Promise<NextResponse> {
  try {
    // Try to get user preferences from the user preferences API
    const response = await fetch(new URL('/api/user/preferences', request.url).toString(), {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })

    if (!response.ok) {
      // If not authenticated or error, return defaults
      return NextResponse.json({ 
        starredModels: DEFAULT_STARRED_MODELS,
        primaryModel: DEFAULT_PRIMARY_MODEL,
        message: 'Using default preferences'
      })
    }

    const data = await response.json()
    const preferences = data.preferences

    return NextResponse.json({ 
      starredModels: preferences.starredModels || DEFAULT_STARRED_MODELS,
      primaryModel: preferences.primaryModel || DEFAULT_PRIMARY_MODEL,
      message: 'User preferences loaded successfully'
    })
  } catch (error) {
    console.error('Starred models GET error:', error)
    return NextResponse.json({ 
      starredModels: DEFAULT_STARRED_MODELS,
      primaryModel: DEFAULT_PRIMARY_MODEL,
      message: 'Using default preferences (error loading)',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleStarredModelsPost(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json()
    const { modelId, action }: { 
      modelId: string; 
      action: 'star' | 'unstar' | 'toggle' | 'set_primary' 
    } = body

    if (!modelId) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      )
    }

    // Map action to user preferences API action
    const apiAction = action === 'set_primary' ? 'setPrimary' : 'toggleStarred'

    // Forward request to user preferences API
    const response = await fetch(new URL('/api/user/preferences', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        action: apiAction,
        modelId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      if (response.status === 401) {
        return NextResponse.json(
          { 
            error: 'Authentication required',
            details: 'You must be logged in to modify starred models'
          },
          { status: 401 }
        )
      }
      
      throw new Error(errorData.error || 'Failed to update preferences')
    }

    const data = await response.json()
    const updatedPreferences = data.preferences
    const isStarred = updatedPreferences.starredModels.includes(modelId)
    
    const message = action === 'set_primary' 
      ? `Primary model set to ${modelId}`
      : `Model ${isStarred ? 'starred' : 'unstarred'} successfully`
    
    return NextResponse.json({ 
      starredModels: updatedPreferences.starredModels,
      primaryModel: updatedPreferences.primaryModel,
      modelId,
      isStarred,
      message
    })
  } catch (error) {
    console.error('Starred models POST error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to update starred models'
      },
      { status: 500 }
    )
  }
}

// Apply security middleware
export const GET = withSecurity(
  withRateLimit(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.API)(
    handleStarredModelsGet
  )
)

export const POST = withSecurity(
  withRateLimit(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.API)(
    handleStarredModelsPost
  )
)