import { NextRequest, NextResponse } from 'next/server'
import { 
  toggleStarredModel,
  setPrimaryModel,
  getUserPreferences,
  DEFAULT_USER_PREFERENCES 
} from '@/lib/db/server-operations'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'
import { getUserId, requireAuth } from '@/lib/auth'

async function handleStarredModelsGet(request: NextRequest): Promise<NextResponse> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { 
          error: 'Supabase not configured',
          details: 'NEXT_PUBLIC_SUPABASE_URL environment variable is required'
        },
        { status: 500 }
      )
    }

    // Get user ID - if not authenticated, return defaults
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ 
        starredModels: DEFAULT_USER_PREFERENCES.starredModels,
        primaryModel: DEFAULT_USER_PREFERENCES.primaryModel,
        message: 'Using default preferences (not authenticated)'
      })
    }

    // User is authenticated - try to get or create preferences
    try {
      const preferences = await getUserPreferences(userId)
      
      return NextResponse.json({ 
        starredModels: preferences.starredModels,
        primaryModel: preferences.primaryModel,
        message: 'User preferences loaded successfully'
      })
    } catch (error) {
      console.error('Error getting user preferences for user', userId, ':', error)
      
      // If we can't get/create preferences, return defaults but log the error
      return NextResponse.json({ 
        starredModels: DEFAULT_USER_PREFERENCES.starredModels,
        primaryModel: DEFAULT_USER_PREFERENCES.primaryModel,
        message: 'Using default preferences (error loading user preferences)',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  } catch (error) {
    console.error('Starred models GET error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to fetch starred models'
      },
      { status: 500 }
    )
  }
}

async function handleStarredModelsPost(request: NextRequest): Promise<NextResponse> {
  try {
    // Require authentication for modifying starred models
    const user = await requireAuth(request)
    
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

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { 
          error: 'Supabase not configured',
          details: 'NEXT_PUBLIC_SUPABASE_URL environment variable is required'
        },
        { status: 500 }
      )
    }

    // Handle different actions
    let updatedPreferences
    let message = ''
    
    if (action === 'set_primary') {
      updatedPreferences = await setPrimaryModel(user.id, modelId)
      message = `Primary model set to ${modelId}`
    } else {
      updatedPreferences = await toggleStarredModel(user.id, modelId)
      const isStarred = updatedPreferences.starredModels.includes(modelId)
      message = `Model ${isStarred ? 'starred' : 'unstarred'} successfully`
    }
    
    const isStarred = updatedPreferences.starredModels.includes(modelId)
    
    return NextResponse.json({ 
      starredModels: updatedPreferences.starredModels,
      primaryModel: updatedPreferences.primaryModel,
      modelId,
      isStarred,
      message
    })
  } catch (error) {
    console.error('Starred models POST error:', error)
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          details: 'You must be logged in to modify starred models'
        },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to toggle starred model'
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