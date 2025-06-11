import { NextRequest, NextResponse } from 'next/server'
import { 
  withSecurity, 
  withRateLimit, 
  SECURITY_CONFIG 
} from '@/lib/security'

/**
 * Legacy user preferences endpoint
 * Redirects to the new /api/user/preferences endpoint
 */

async function handleUserPreferencesGet(request: NextRequest): Promise<NextResponse> {
  try {
    // Forward to new user preferences API
    const response = await fetch(new URL('/api/user/preferences', request.url).toString(), {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('User preferences GET error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to fetch user preferences'
      },
      { status: 500 }
    )
  }
}

async function handleUserPreferencesPost(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json()

    // Forward to new user preferences API
    const response = await fetch(new URL('/api/user/preferences', request.url).toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify(body.preferences || body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
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