import React, { createContext, useContext } from 'react';
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

export const BetterAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, isPending: loading } = useSession();
  
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
      const result = await betterSignIn.email({
        email,
        password,
      });

      if (result.error) {
        console.error('Sign in error:', result.error);
        return { error: new Error(result.error.message || 'Sign in failed') };
      }

      console.log('✅ Sign in successful');
      return { error: null };
    } catch (error) {
      console.error('💥 Unexpected sign in error:', error);
      return { error: error as Error };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      await betterSignOut();
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: error as Error };
    }
  };

  // Update profile function (placeholder - needs implementation)
  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      // BetterAuth profile updates would go here
      // For now, return success
      console.log('Profile update requested:', updates);
      return { error: null };
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