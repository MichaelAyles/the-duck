'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check if Supabase is properly configured (not using mock client)
  const isConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (!isConfigured) {
      // If using mock client, set loading to false immediately
      setLoading(false);
      return;
    }

    // Timeout fallback to prevent infinite loading
    const timeout = setTimeout(() => {
      console.warn('Auth loading timeout - proceeding without authentication');
      setLoading(false);
    }, 5000); // 5 second timeout

    // Get initial session - only if we have a real Supabase client
    const getInitialSession = async () => {
      try {
        // Type guard to check if auth methods exist
        if ('getSession' in supabase.auth) {
          const { data: { session } } = await supabase.auth.getSession();
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes - only if we have a real Supabase client
    let unsubscribe: (() => void) | null = null;
    
    if ('onAuthStateChange' in supabase.auth) {
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
    if (isConfigured && 'signOut' in supabase.auth) {
      await supabase.auth.signOut();
    }
  };

  const value = {
    user,
    session,
    loading,
    logout,
    isConfigured,
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