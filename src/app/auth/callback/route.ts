import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (code) {
    try {
      // Use the current Supabase auth method
      if ('exchangeCodeForSession' in supabase.auth) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('Auth callback error:', error);
          return NextResponse.redirect(`${origin}?error=auth_failed`);
        }
      }
    } catch (error) {
      console.error('Auth exchange error:', error);
      return NextResponse.redirect(`${origin}?error=auth_failed`);
    }
  }

  // Redirect to the main page after successful authentication
  return NextResponse.redirect(origin);
} 