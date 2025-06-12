'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
  isConfigured: boolean;
  debugInfo?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  
  // Check if Supabase is properly configured
  const isConfigured = isSupabaseConfigured;

  useEffect(() => {
    if (!isConfigured) {
      // If using mock client, set loading to false immediately
      setDebugInfo('Supabase not configured - running without auth');
      setLoading(false);
      return;
    }

    // Timeout fallback to prevent infinite loading
    const timeout = setTimeout(() => {
      console.warn('Auth loading timeout - proceeding without authentication');
      setDebugInfo('Auth timeout - proceeding without session');
      setLoading(false);
    }, 5000); // 5 second timeout

    // Get initial session - only if we have a real Supabase client
    const getInitialSession = async () => {
      try {
        setDebugInfo('Checking for existing session...');
        
        // Check if supabase client exists and has auth methods
        if (supabase && 'getSession' in supabase.auth) {
          const { data: { session } } = await supabase.auth.getSession();
          setSession(session);
          setUser(session?.user ?? null);
          setDebugInfo(session ? 'User authenticated' : 'No active session');
        } else {
          console.warn('Supabase client not available - skipping session retrieval');
          setDebugInfo('Supabase client unavailable');
        }
      } catch (error) {
        console.error('Error getting session:', error);
        setDebugInfo(`Auth error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes - only if we have a real Supabase client
    let unsubscribe: (() => void) | null = null;
    
    if (supabase && 'onAuthStateChange' in supabase.auth) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          setSession(session);
          setUser(session?.user ?? null);
          clearTimeout(timeout);
          setLoading(false);
        }
      );
      unsubscribe = () => subscription.unsubscribe();
    }

    return () => {
      clearTimeout(timeout);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isConfigured]);

  const logout = async () => {
    if (isConfigured && supabase && 'signOut' in supabase.auth) {
      await supabase.auth.signOut();
    }
  };

  const value = {
    user,
    session,
    loading,
    logout,
    isConfigured,
    debugInfo,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 