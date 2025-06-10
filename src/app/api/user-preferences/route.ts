import { NextRequest, NextResponse } from 'next/server'
import { 
  getUserPreferences, 
  updateUserPreferences, 
  UserPreferencesData,
  DEFAULT_USER_PREFERENCES 
} from '@/lib/db/supabase-operations'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'

async function handleUserPreferencesGet(request: NextRequest): Promise<NextResponse> {
  try {
    // For development, we'll use a mock user ID
    // In production, this would be extracted from the authenticated session
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

    // Get user preferences
    const preferences = await getUserPreferences(mockUserId)
    
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
    const updatedPreferences = await updateUserPreferences(mockUserId, preferences)
    
    return NextResponse.json({ 
      preferences: updatedPreferences,
      message: 'Preferences updated successfully'
    })
  } catch (error) {
    console.error('User preferences POST error:', error)
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