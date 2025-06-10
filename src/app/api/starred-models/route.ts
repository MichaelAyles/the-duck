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
      return NextResponse.json(
        { 
          error: 'Supabase not configured',
          details: 'NEXT_PUBLIC_SUPABASE_URL environment variable is required'
        },
        { status: 500 }
      )
    }

    // Get user preferences to extract starred models
    const preferences = await getUserPreferences(mockUserId)
    
    return NextResponse.json({ 
      starredModels: preferences.starredModels
    })
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
      return NextResponse.json(
        { 
          error: 'Supabase not configured',
          details: 'NEXT_PUBLIC_SUPABASE_URL environment variable is required'
        },
        { status: 500 }
      )
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