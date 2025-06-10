/**
 * 🔐 Authentication Configuration
 * 
 * Handles auth configuration for both development and production environments
 */

export function getAuthConfig() {
  // Determine the current environment's base URL
  const getBaseUrl = () => {
    // For server-side rendering, use the app URL from env
    if (typeof window === 'undefined') {
      return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:12000';
    }
    
    // For client-side, use the current origin
    return window.location.origin;
  };

  const baseUrl = getBaseUrl();
  
  return {
    baseUrl,
    redirectUrl: `${baseUrl}/auth/callback`,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || 
         (typeof window !== 'undefined' && window.location.hostname === 'localhost');
}

/**
 * Get the appropriate redirect URL for OAuth providers
 */
export function getOAuthRedirectUrl(): string {
  const config = getAuthConfig();
  return config.redirectUrl;
} 