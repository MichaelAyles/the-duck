'use client';

import { ChatInterface } from "@/components/chat/chat-interface";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/components/auth/auth-provider";

export default function Home() {
  const { user, loading, isConfigured } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl animate-bounce">🦆</div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If Supabase isn't configured, show the app without auth
  if (!isConfigured) {
    return <ChatInterface />;
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
  return <ChatInterface />;
}
