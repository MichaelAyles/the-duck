'use client';

import { useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './auth-provider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';
import { getOAuthRedirectUrl } from '@/lib/auth-config';
import { DuckLogo } from '@/components/duck-logo';

export function LoginForm() {
  const { isConfigured } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  if (!isConfigured) {
    return (
      <Card className="p-8 max-w-md mx-auto">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <DuckLogo variant="duck" size="xl" />
          </div>
          <h1 className="text-2xl font-bold">The Duck</h1>
          <p className="text-muted-foreground text-center">
            Supabase authentication is not configured in this environment.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Please set up your environment variables to enable authentication.
          </p>
        </div>
      </Card>
    );
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      if (supabase && 'signInWithOAuth' in supabase.auth) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: getOAuthRedirectUrl()
          }
        });
        if (error) {
          console.error('Google login error:', error);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setIsLoading(true);
    try {
      if (supabase && 'signInWithOAuth' in supabase.auth) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: getOAuthRedirectUrl()
          }
        });
        if (error) {
          console.error('GitHub login error:', error);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-8 max-w-md mx-auto">
      <div className="text-center space-y-6">
        {/* Duck header */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="animate-bounce">
              <DuckLogo variant="full" size="xl" />
            </div>
          </div>
          <p className="text-muted-foreground text-center">
            Your personal duck that quacks back
          </p>
        </div>

        {/* Social login buttons */}
        <div className="space-y-3">
          <Button 
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full"
            variant="outline"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          <Button 
            onClick={handleGithubLogin}
            disabled={isLoading}
            className="w-full"
            variant="outline"
          >
            <Github className="w-5 h-5 mr-2" />
            Continue with GitHub
          </Button>
        </div>

        {/* Email/password auth fallback */}
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          {isConfigured && supabase && 'supabaseUrl' in supabase && (
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#3b82f6',
                      brandAccent: '#2563eb',
                    },
                  },
                },
                className: {
                  container: 'auth-container',
                  button: 'auth-button',
                  input: 'auth-input',
                },
              }}
              providers={[]}
              view="sign_in"
              showLinks={true}
              redirectTo={getOAuthRedirectUrl()}
            />
          )}
        </div>
      </div>
    </Card>
  );
} 