import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthConfig, isDevelopment } from '@/lib/auth-config';

export async function GET(request: NextRequest) {
  try {
    const authConfig = getAuthConfig();
    const supabase = createClient(
      authConfig.supabaseUrl,
      authConfig.supabaseAnonKey
    );

    // Test basic connectivity
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    
    // Test if we can query the auth.users table (this will fail if RLS is too restrictive)
    const { data: userData, error: userError } = await supabase.auth.getUser();

    return NextResponse.json({
      status: 'success',
      environment: {
        isDevelopment: isDevelopment(),
        nodeEnv: process.env.NODE_ENV,
        baseUrl: authConfig.baseUrl,
        redirectUrl: authConfig.redirectUrl,
      },
      config: {
        supabaseUrl: authConfig.supabaseUrl,
        hasAnonKey: !!authConfig.supabaseAnonKey,
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
      },
      auth: {
        hasSession: !!session,
        sessionError: sessionError?.message || null,
        userError: userError?.message || null,
        user: userData?.user ? {
          id: userData.user.id,
          email: userData.user.email,
          provider: userData.user.app_metadata?.provider
        } : null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 