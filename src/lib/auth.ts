import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { logger } from '@/lib/logger'

/**
 * 🔐 Server-side Authentication Utilities
 * 
 * Helper functions for handling authentication in API routes
 */

/**
 * Create a server-side Supabase client that can read cookies from the request
 */
function createSupabaseServerClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set() {
          // For API routes, we don't need to set cookies, but we need to provide the method
        },
        remove() {
          // For API routes, we don't need to remove cookies, but we need to provide the method
        },
      },
    }
  )
}

/**
 * Extract authenticated user from request
 * Uses server-side client to read auth cookies
 */
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient(request)
    
    // First try to get the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      logger.error('Session error:', sessionError)
      return null
    }
    
    if (!session) {
      logger.dev.log('No session found')
      return null
    }
    
    // If we have a session, get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      logger.error('User error:', userError)
      return null
    }

    if (!user) {
      logger.dev.log('No user found despite having session')
      return null
    }

    logger.dev.log('Successfully authenticated user:', user.id, user.email)
    return user
  } catch (error) {
    logger.error('Error getting authenticated user:', error)
    return null
  }
}

/**
 * Get user ID from request - returns null if not authenticated
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  const user = await getAuthenticatedUser(request)
  return user?.id || null
}

/**
 * Require authentication - throws error if user is not authenticated
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  
  if (!user) {
    throw new Error('Authentication required')
  }
  
  return user
} 