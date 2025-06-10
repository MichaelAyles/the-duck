import { NextRequest, NextResponse } from 'next/server'
import { 
  getUserPreferences, 
  updateUserPreferences, 
  UserPreferencesData,
  DEFAULT_USER_PREFERENCES 
} from '@/lib/db/server-operations'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'
import { getUserId, requireAuth } from '@/lib/auth'

async function handleUserPreferencesGet(request: NextRequest): Promise<NextResponse> {
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
        preferences: DEFAULT_USER_PREFERENCES,
        message: 'Using default preferences (not authenticated)'
      })
    }

    // Get user preferences
    const preferences = await getUserPreferences(userId)
    
    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('User preferences GET error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to fetch or create user preferences'
      },
      { status: 500 }
    )
  }
}

async function handleUserPreferencesPost(request: NextRequest): Promise<NextResponse> {
  try {
    // Require authentication for updating preferences
    const user = await requireAuth(request)
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { 
          error: 'Supabase not configured',
          details: 'NEXT_PUBLIC_SUPABASE_URL environment variable is required'
        },
        { status: 500 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { preferences }: { preferences: Partial<UserPreferencesData> } = body

    if (!preferences) {
      return NextResponse.json(
        { error: 'Preferences data is required' },
        { status: 400 }
      )
    }

    // Update user preferences
    const updatedPreferences = await updateUserPreferences(user.id, preferences)
    
    return NextResponse.json({ 
      preferences: updatedPreferences,
      message: 'Preferences updated successfully'
    })
  } catch (error) {
    console.error('User preferences POST error:', error)
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          details: 'You must be logged in to update preferences'
        },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to update user preferences'
      },
      { status: 500 }
    )
  }
}

// Apply security middleware
export const GET = withSecurity(
  withRateLimit(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.API)(
    handleUserPreferencesGet
  )
)

export const POST = withSecurity(
  withRateLimit(SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS.API)(
    handleUserPreferencesPost
  )
) 