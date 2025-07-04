'use client';

import { useEffect, useState } from "react";
import { ChatLayout } from "@/components/chat/chat-layout";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/components/auth/auth-provider";
import { DuckLogo } from "@/components/duck-logo";

export default function Home() {
  const { user, loading, isConfigured, debugInfo } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading screen while mounting or while auth is loading
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="animate-bounce">
              <DuckLogo variant="duck" size="xl" />
            </div>
          </div>
          <p className="text-muted-foreground">Loading...</p>
          {debugInfo && (
            <p className="text-xs text-muted-foreground/70">{debugInfo}</p>
          )}
        </div>
      </div>
    );
  }

  // If Supabase isn't configured, show the app without auth
  if (!isConfigured) {
    return <ChatLayout />;
  }

  // If configured but user not logged in, show login
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LoginForm />
      </div>
    );
  }

  // User is authenticated, show the chat interface
  return <ChatLayout />;
}
