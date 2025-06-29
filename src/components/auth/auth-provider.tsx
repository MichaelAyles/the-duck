'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logger } from '@/lib/logger';

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
    if (!isConfigured || !supabase) {
      // If Supabase is not configured or client is null, set loading to false immediately
      setDebugInfo('Supabase not configured - running without auth');
      if (process.env.NODE_ENV === 'development') logger.dev.log('Auth: Supabase not configured - proceeding without authentication');
      setLoading(false);
      return;
    }

    // Timeout fallback to prevent infinite loading
    const timeout = setTimeout(() => {
      logger.warn('Auth loading timeout - proceeding without authentication');
      setDebugInfo('Auth timeout - proceeding without session');
      setLoading(false);
    }, 1000); // Reduced to 1 second timeout for faster loading

    // Get initial session - only if we have a real Supabase client
    const getInitialSession = async () => {
      try {
        setDebugInfo('Checking for existing session...');
        if (process.env.NODE_ENV === 'development') logger.dev.log('Auth: Checking for existing session...');
        
        // Double-check supabase client exists and has auth methods
        if (supabase && supabase.auth && typeof supabase.auth.getSession === 'function') {
          if (process.env.NODE_ENV === 'development') logger.dev.log('Auth: Supabase client available, getting session');
          const { data: { session } } = await supabase.auth.getSession();
          if (process.env.NODE_ENV === 'development') logger.dev.log('Auth: Session retrieved:', session ? 'authenticated' : 'no session');
          setSession(session);
          setUser(session?.user ?? null);
          setDebugInfo(session ? 'User authenticated' : 'No active session');
        } else {
          logger.warn('Supabase client not available - skipping session retrieval');
          setDebugInfo('Supabase client unavailable');
        }
      } catch (error) {
        logger.error('Error getting session:', error);
        setDebugInfo(`Auth error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes - only if we have a real Supabase client
    let unsubscribe: (() => void) | null = null;
    
    if (supabase && supabase.auth && typeof supabase.auth.onAuthStateChange === 'function') {
      try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event: AuthChangeEvent, session: Session | null) => {
            setSession(session);
            setUser(session?.user ?? null);
            clearTimeout(timeout);
            setLoading(false);
          }
        );
        unsubscribe = () => subscription.unsubscribe();
      } catch (error) {
        logger.error('Error setting up auth state listener:', error);
        clearTimeout(timeout);
        setLoading(false);
      }
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