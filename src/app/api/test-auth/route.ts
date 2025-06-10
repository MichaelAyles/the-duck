import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getAuthenticatedUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Debug: Log all cookies
    const cookieNames = request.cookies.getAll().map(c => c.name)
    const supabaseCookies = request.cookies.getAll().filter(c => c.name.includes('supabase'))
    
    console.log('All cookies:', cookieNames)
    console.log('Supabase cookies:', supabaseCookies.map(c => ({ name: c.name, hasValue: !!c.value })))
    
    const userId = await getUserId(request)
    const user = await getAuthenticatedUser(request)
    
    return NextResponse.json({
      authenticated: !!userId,
      userId,
      userEmail: user?.email || null,
      userMetadata: user?.user_metadata || null,
      appMetadata: user?.app_metadata || null,
      debug: {
        totalCookies: cookieNames.length,
        supabaseCookies: supabaseCookies.length,
        cookieNames: cookieNames,
        supabaseCookieNames: supabaseCookies.map(c => c.name)
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Test auth error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      authenticated: false,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 