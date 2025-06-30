'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global Error Page for Next.js App Router
 * 
 * This page is shown when an unhandled error occurs anywhere in the application.
 * It provides a user-friendly error message and recovery options.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  React.useEffect(() => {
    // Log error details for debugging
    console.error('Global error caught:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  const isNetworkError = error.message?.toLowerCase().includes('network') || 
                        error.message?.toLowerCase().includes('fetch');
  
  const isAuthError = error.message?.toLowerCase().includes('auth') ||
                     error.message?.toLowerCase().includes('unauthorized');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold tracking-tight">
            Oops! Something went wrong
          </h1>
          <p className="text-muted-foreground">
            {isNetworkError && "It looks like you're having connection issues. Please check your internet connection and try again."}
            {isAuthError && "There was an authentication problem. Please try signing in again."}
            {!isNetworkError && !isAuthError && "We encountered an unexpected error. Our team has been notified and we're working to fix it."}
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="text-left bg-destructive/10 p-4 rounded-lg">
            <summary className="cursor-pointer font-medium text-destructive mb-2">
              Error Details (Development Only)
            </summary>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Message:</strong> {error.message}
              </div>
              {error.digest && (
                <div>
                  <strong>Error ID:</strong> {error.digest}
                </div>
              )}
              {error.stack && (
                <div>
                  <strong>Stack Trace:</strong>
                  <pre className="mt-1 text-xs overflow-auto max-h-32 bg-background/50 p-2 rounded">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          
          <Button variant="outline" asChild>
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>
            If this problem persists, please{' '}
            <Link 
              href="https://github.com/anthropics/claude-code/issues" 
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              report it on GitHub
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}