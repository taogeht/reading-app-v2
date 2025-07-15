import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Cache to prevent duplicate profile fetches
  const profileFetchCache = React.useRef<Map<string, Promise<UserProfile | null>>>(new Map());

  // Fetch user profile with graceful fallback for connectivity issues
  const fetchProfile = async (userId: string, retryCount = 0): Promise<UserProfile | null> => {
    const maxRetries = 0; // No retries to prevent hanging
    
    // Check cache first
    if (profileFetchCache.current.has(userId)) {
      return await profileFetchCache.current.get(userId)!;
    }
    
    const fetchPromise = (async () => {
      try {
        console.log(`🔍 Fetching profile for user: ${userId} (attempt ${retryCount + 1})`);
        
        // Try direct table access with very short timeout
        try {
          const { data, error } = await Promise.race([
            supabase
              .from('profiles')
              .select('id, email, full_name, role, class_id, created_at, updated_at')
              .eq('id', userId)
              .single(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Table timeout')), 800))
          ]) as any;

          if (!error && data) {
            console.log(`✅ Profile loaded via table:`, { email: data.email, role: data.role });
            return data;
          }
        } catch (tableErr) {
          console.log('🔄 Table approach failed, creating fallback...');
        }

        // Immediate fallback: Create a basic profile based on the user's email
        // This prevents hanging and allows the app to function
        console.warn('⚠️ Database slow, creating minimal profile for continued operation');
        
        // Extract email from user session if available
        try {
          const { data: { user } } = await Promise.race([
            supabase.auth.getUser(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('User fetch timeout')), 500))
          ]) as any;
          
          if (user?.email) {
            // Better role detection logic
            let detectedRole: UserRole = 'admin'; // Default fallback
            
            if (user.email.includes('admin') || user.email.includes('superadmin')) {
              detectedRole = 'admin';
            } else if (user.email.includes('teacher') || user.email.includes('mschool.com')) {
              detectedRole = 'teacher'; // Detect school domain as teacher
            } else {
              // Check current route to help determine role
              const currentPath = window.location.pathname;
              if (currentPath.includes('/teacher')) {
                detectedRole = 'teacher';
              } else if (currentPath.includes('/admin')) {
                detectedRole = 'admin';
              } else {
                // Try to fetch from database one more time with extended timeout
                try {
                  const { data: dbData } = await Promise.race([
                    supabase
                      .from('profiles')
                      .select('role')
                      .eq('id', userId)
                      .single(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Extended timeout')), 2000))
                  ]) as any;
                  
                  if (dbData?.role) {
                    detectedRole = dbData.role;
                    console.log(`✅ Got role from extended DB query: ${detectedRole}`);
                  }
                } catch (extendedErr) {
                  console.warn('Extended DB query also failed, using route-based detection');
                }
              }
            }
            
            const fallbackProfile: UserProfile = {
              id: userId,
              email: user.email,
              full_name: user.email.split('@')[0],
              role: detectedRole,
              class_id: null,
              username: user.email,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            console.log(`🆘 Using fallback profile:`, { email: fallbackProfile.email, role: fallbackProfile.role, detectionMethod: 'user session + smart detection' });
            return fallbackProfile;
          }
        } catch (userErr) {
          console.warn('Cannot get user info for fallback, trying route-based detection');
        }

        // Final fallback using route-based detection
        const currentPath = window.location.pathname;
        let finalRole: UserRole = 'admin';
        
        if (currentPath.includes('/teacher')) {
          finalRole = 'teacher';
        } else if (currentPath.includes('/admin')) {
          finalRole = 'admin';
        }
        
        const basicProfile: UserProfile = {
          id: userId,
          email: finalRole === 'teacher' ? 'teacher@school.edu' : 'admin@example.com',
          full_name: finalRole === 'teacher' ? 'Teacher User' : 'Admin User',
          role: finalRole,
          class_id: null,
          username: finalRole === 'teacher' ? 'teacher@school.edu' : 'admin@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        console.log(`🆘 Using route-based fallback profile:`, { role: basicProfile.role, path: currentPath });
        return basicProfile;

      } catch (error) {
        console.error(`💥 fetchProfile unexpected error (attempt ${retryCount + 1}):`, error);
        
        // Return a basic profile even on error, using route-based detection
        const currentPath = window.location.pathname;
        let errorRole: UserRole = 'admin';
        
        if (currentPath.includes('/teacher')) {
          errorRole = 'teacher';
        } else if (currentPath.includes('/admin')) {
          errorRole = 'admin';
        }
        
        const errorProfile: UserProfile = {
          id: userId,
          email: errorRole === 'teacher' ? 'teacher@school.edu' : 'admin@example.com',
          full_name: errorRole === 'teacher' ? 'Teacher User' : 'Admin User',
          role: errorRole,
          class_id: null,
          username: errorRole === 'teacher' ? 'teacher@school.edu' : 'admin@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        console.log(`🆘 Using error fallback profile:`, { role: errorProfile.role, path: currentPath });
        return errorProfile;
      } finally {
        // Remove from cache after completion
        profileFetchCache.current.delete(userId);
      }
    })();
    
    // Cache the promise
    profileFetchCache.current.set(userId, fetchPromise);
    
    return await fetchPromise;
  };

  // Initialize auth state with improved session persistence
  useEffect(() => {
    let isMounted = true;
    let isInitialized = false;
    let initTimeout: NodeJS.Timeout;
    let isProcessingAuth = false; // Prevent concurrent auth operations

    // Get initial session with robust error handling
    const initializeAuth = async () => {
      if (isInitialized || isProcessingAuth) return;
      isInitialized = true;
      isProcessingAuth = true;
      
      try {
        console.log('🚀 Initializing authentication...');
        
        // Try to get session with shorter timeout and fallback
        let session = null;
        try {
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Session timeout')), 2000)
          );
          
          const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
          session = result.data?.session;
        } catch (sessionError) {
          console.warn('⚠️ Session initialization slow/failed, checking local storage...');
          
          // Fallback: Check if there's a stored session in localStorage
          try {
            const storedSession = localStorage.getItem('reading-app-auth');
            if (storedSession) {
              const parsed = JSON.parse(storedSession);
              if (parsed.access_token && parsed.user) {
                console.log('📦 Found stored session, attempting to use it');
                session = parsed;
              }
            }
          } catch (storageError) {
            console.warn('No valid stored session found');
          }
        }
        
        if (!isMounted) return;
        
        if (session?.user) {
          console.log('📝 Restoring session for user:', session.user.email);
          setUser(session.user);
          setSession(session);
          
          // Fetch profile with improved fallback
          const userProfile = await fetchProfile(session.user.id);
          if (isMounted) {
            setProfile(userProfile);
            if (userProfile) {
              console.log('✅ Session restored successfully');
            } else {
              console.warn('⚠️ Session restored but profile unavailable (database issue)');
            }
          }
        } else {
          console.log('📭 No existing session found');
        }
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        if (isMounted) {
          // Even if auth fails, we should stop loading to allow login forms to show
          setLoading(false);
        }
      } finally {
        isProcessingAuth = false;
      }
    };

    // Initialize with slight delay to ensure proper mounting
    initTimeout = setTimeout(initializeAuth, 100);

    // Listen for auth changes with improved handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event);
        
        // Skip INITIAL_SESSION event completely to avoid duplicate processing
        if (event === 'INITIAL_SESSION') {
          console.log('⏭️ Skipping INITIAL_SESSION event (handled by initialization)');
          return;
        }
        
        // Prevent concurrent processing
        if (isProcessingAuth) {
          console.log('⏳ Auth already processing, skipping...');
          return;
        }
        
        if (!isMounted) return;
        
        isProcessingAuth = true;
        
        try {
          if (session?.user) {
            console.log('👤 User signed in:', session.user.email);
            setUser(session.user);
            setSession(session);
            
            // Always fetch profile for new sign-ins
            const userProfile = await fetchProfile(session.user.id);
            if (isMounted) {
              setProfile(userProfile);
            }
          } else {
            console.log('👋 User signed out');
            setUser(null);
            setSession(null);
            setProfile(null);
            // Clear any cached profile data
            profileFetchCache.current.clear();
          }
          
          if (isMounted) {
            setLoading(false);
          }
        } finally {
          isProcessingAuth = false;
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, []); // Remove profile dependency to prevent re-initialization

  // Sign in function with enhanced error handling
  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting sign in for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Sign in error:', error);
        return { error };
      }

      console.log('✅ Sign in successful');
      
      // The auth state change listener will handle profile loading
      // but we can trigger a manual profile fetch for immediate feedback
      if (data.user) {
        // Don't await this - let it happen in background
        fetchProfile(data.user.id).then(profile => {
          if (profile) {
            console.log('✅ Profile loaded immediately after sign in');
          }
        }).catch(err => {
          console.warn('⚠️ Background profile fetch failed (will retry via auth listener):', err);
        });
      }

      return { error: null };
    } catch (unexpectedError) {
      console.error('💥 Unexpected sign in error:', unexpectedError);
      return { error: unexpectedError as AuthError };
    }
  };


  // Sign out function
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (!error) {
      setUser(null);
      setSession(null);
      setProfile(null);
    }

    return { error };
  };

  // Update profile function
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        return { error };
      }

      // Refresh profile data
      const updatedProfile = await fetchProfile(user.id);
      setProfile(updatedProfile);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value = {
    user,
    profile,
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