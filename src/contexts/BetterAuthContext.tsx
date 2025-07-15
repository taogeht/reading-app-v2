import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession, signIn as betterSignIn, signOut as betterSignOut } from '../lib/auth-client';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  full_name: string | null;
  role: UserRole;
  class_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  session: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Custom hook to safely handle auth session
const useSafeSession = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      // This is a workaround since we can't conditionally call useSession
      const sessionData = useSession();
      setSession(sessionData.data);
      setLoading(sessionData.isPending);
      setError(null);
    } catch (err) {
      console.warn("Auth session unavailable, using mock state:", err);
      setSession(null);
      setLoading(false);
      setError(err);
    }
  }, []);

  return { session, loading, error };
};

export const BetterAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Safely try to use auth session with fallback
  useEffect(() => {
    try {
      // Try to use the real useSession hook
      const sessionData = useSession();
      if (sessionData) {
        setSession(sessionData.data);
        setLoading(sessionData.isPending);
        return;
      }
    } catch (error) {
      console.warn("Auth session not available, using mock state:", error);
    }
    
    // Fallback to mock state
    console.warn("BetterAuth not fully configured - using mock session state");
    setSession(null);
    setLoading(false);
  }, []);
  
  // Convert BetterAuth session data to our UserProfile format
  const user = session?.user ? {
    id: session.user.id,
    email: session.user.email,
    username: session.user.username || session.user.email,
    full_name: session.user.full_name || null,
    role: (session.user.role as UserRole) || 'student',
    class_id: session.user.class_id || null,
    created_at: session.user.createdAt || new Date().toISOString(),
    updated_at: session.user.updatedAt || new Date().toISOString(),
  } : null;

  // Sign in function compatible with existing interface
  const signIn = async (email: string, password: string) => {
    try {
      console.warn("Auth sign in not fully configured - using mock");
      // TODO: Implement actual sign in when server-side auth is working
      return { error: new Error("Authentication not configured") };
    } catch (error) {
      console.error('💥 Unexpected sign in error:', error);
      return { error: error as Error };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      console.warn("Auth sign out not fully configured - using mock");
      // TODO: Implement actual sign out when server-side auth is working
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: error as Error };
    }
  };

  // Update profile function (placeholder - needs implementation)
  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      console.warn("Auth profile update not fully configured - using mock");
      // TODO: Implement actual profile update when server-side auth is working
      console.log('Profile update requested:', updates);
      return { error: new Error('Profile update not implemented') };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value = {
    user,
    profile: user, // Same as user for BetterAuth
    session,
    loading,
    signIn,
    signOut,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};