// Unified Authentication Context
// Replaces both BetterAuthContext and StudentAuthContext with a single unified system

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import type { UserSession, SignUpRequest, SignInRequest, VisualPassword } from '../services/apiClient';

export type UserRole = 'student' | 'teacher' | 'admin';

// Unified auth context interface
interface UnifiedAuthContextType {
  // Session state
  user: UserSession | null;
  loading: boolean;
  isAuthenticated: boolean;

  // Authentication methods
  signIn: (credentials: SignInRequest) => Promise<{ error?: string }>;
  signUp: (userData: SignUpRequest) => Promise<{ error?: string }>;
  signOut: () => Promise<{ error?: string }>;
  forgotPassword: (email: string) => Promise<{ error?: string }>;

  // Profile management
  updateProfile: (updates: Partial<UserSession>) => Promise<{ error?: string }>;

  // Visual password support for students
  getVisualPasswords: () => Promise<{ passwords?: VisualPassword[]; error?: string }>;

  // Class access for students
  authenticateWithClass: (
    classAccessToken: string,
    studentName: string,
    visualPasswordId: string
  ) => Promise<{ error?: string }>;
}

const UnifiedAuthContext = createContext<UnifiedAuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(UnifiedAuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a UnifiedAuthProvider');
  }
  return context;
};

export const UnifiedAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const { user: sessionUser, error } = await apiClient.getSession();
        
        if (sessionUser && !error) {
          setUser(sessionUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.warn('Failed to initialize session:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeSession();
  }, []);

  // Sign in with email/password or visual password
  const signIn = async (credentials: SignInRequest): Promise<{ error?: string }> => {
    setLoading(true);
    
    try {
      const { user: authUser, token, error } = await apiClient.signIn(credentials);
      
      if (authUser && token && !error) {
        setUser(authUser);
        return {};
      }
      
      return { error: error || 'Authentication failed' };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: 'Sign in failed' };
    } finally {
      setLoading(false);
    }
  };

  // Sign up new user
  const signUp = async (userData: SignUpRequest): Promise<{ error?: string }> => {
    setLoading(true);
    
    try {
      const { user: newUser, error } = await apiClient.signUp(userData);
      
      if (newUser && !error) {
        // After successful signup, sign them in
        const signInCredentials: SignInRequest = {
          email: userData.email,
          password: userData.password,
        };
        
        return await signIn(signInCredentials);
      }
      
      return { error: error || 'Registration failed' };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async (): Promise<{ error?: string }> => {
    setLoading(true);
    
    try {
      const { error } = await apiClient.signOut();
      setUser(null);
      
      return { error };
    } catch (error) {
      console.error('Sign out error:', error);
      setUser(null); // Clear user even if API call fails
      return { error: 'Sign out failed' };
    } finally {
      setLoading(false);
    }
  };

  // Forgot password
  const forgotPassword = async (email: string): Promise<{ error?: string }> => {
    try {
      return await apiClient.forgotPassword(email);
    } catch (error) {
      console.error('Forgot password error:', error);
      return { error: 'Password reset failed' };
    }
  };

  // Update user profile
  const updateProfile = async (updates: Partial<UserSession>): Promise<{ error?: string }> => {
    if (!user) {
      return { error: 'No authenticated user' };
    }

    try {
      const { user: updatedUser, error } = await apiClient.updateUser(user.id, updates);
      
      if (updatedUser && !error) {
        setUser(updatedUser);
        return {};
      }
      
      return { error: error || 'Profile update failed' };
    } catch (error) {
      console.error('Update profile error:', error);
      return { error: 'Profile update failed' };
    }
  };

  // Get visual passwords for student authentication
  const getVisualPasswords = async (): Promise<{ passwords?: VisualPassword[]; error?: string }> => {
    try {
      return await apiClient.getVisualPasswords();
    } catch (error) {
      console.error('Get visual passwords error:', error);
      return { error: 'Failed to fetch visual passwords' };
    }
  };

  // Authenticate student with class access token and visual password
  const authenticateWithClass = async (
    classAccessToken: string,
    studentName: string,
    visualPasswordId: string
  ): Promise<{ error?: string }> => {
    const credentials: SignInRequest = {
      full_name: studentName,
      visual_password_id: visualPasswordId,
      class_access_token: classAccessToken,
    };

    return await signIn(credentials);
  };

  const value: UnifiedAuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    forgotPassword,
    updateProfile,
    getVisualPasswords,
    authenticateWithClass,
  };

  return (
    <UnifiedAuthContext.Provider value={value}>
      {children}
    </UnifiedAuthContext.Provider>
  );
};

// Export types
export type { UserSession, SignUpRequest, SignInRequest, VisualPassword };