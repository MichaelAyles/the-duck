import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (code) {
    try {
      // Create a new Supabase client for the callback
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(`${origin}?error=auth_failed`);
      }
    } catch (error) {
      console.error('Auth exchange error:', error);
      return NextResponse.redirect(`${origin}?error=auth_failed`);
    }
  }

  // Redirect to the main page after successful authentication
  return NextResponse.redirect(origin);
} 