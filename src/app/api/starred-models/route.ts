import { NextRequest, NextResponse } from 'next/server'
import { 
  toggleStarredModel,
  getUserPreferences,
  DEFAULT_USER_PREFERENCES 
} from '@/lib/db/supabase-operations'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'

async function handleStarredModelsGet(request: NextRequest): Promise<NextResponse> {
  try {
    // For development, we'll use a mock user ID
    const mockUserId = 'mock-user-id'
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      // Development mode - return default starred models
      return NextResponse.json({ 
        starredModels: DEFAULT_USER_PREFERENCES.starredModels,
        message: 'Development mode - using default starred models'
      })
    }

    // Get user preferences to extract starred models
    const preferences = await getUserPreferences(mockUserId)
    
    return NextResponse.json({ 
      starredModels: preferences.starredModels || DEFAULT_USER_PREFERENCES.starredModels
    })
  } catch (error) {
    console.error('Starred models GET error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        starredModels: DEFAULT_USER_PREFERENCES.starredModels // Fallback
      },
      { status: 500 }
    )
  }
}

async function handleStarredModelsPost(request: NextRequest): Promise<NextResponse> {
  try {
    // For development, we'll use a mock user ID
    const mockUserId = 'mock-user-id'
    
    // Parse request body
    const body = await request.json()
    const { modelId, action }: { modelId: string; action: 'star' | 'unstar' | 'toggle' } = body

    if (!modelId) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      // Development mode - simulate toggle
      const currentStarred = DEFAULT_USER_PREFERENCES.starredModels
      const isStarred = currentStarred.includes(modelId)
      
      let newStarredModels: string[]
      if (action === 'star' || (action === 'toggle' && !isStarred)) {
        newStarredModels = isStarred ? currentStarred : [...currentStarred, modelId]
      } else {
        newStarredModels = currentStarred.filter(id => id !== modelId)
      }
      
      return NextResponse.json({ 
        starredModels: newStarredModels,
        modelId,
        isStarred: newStarredModels.includes(modelId),
        message: 'Development mode - starred models not persisted'
      })
    }

    // Toggle starred model in database
    const updatedPreferences = await toggleStarredModel(mockUserId, modelId)
    const isStarred = updatedPreferences.starredModels.includes(modelId)
    
    return NextResponse.json({ 
      starredModels: updatedPreferences.starredModels,
      modelId,
      isStarred,
      message: `Model ${isStarred ? 'starred' : 'unstarred'} successfully`
    })
  } catch (error) {
    console.error('Starred models POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
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