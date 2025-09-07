// Simple custom auth client for teachers/admins and students
// Replaces BetterAuth with lightweight fetch-based authentication

const API_BASE_URL = window.location.origin;

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  class_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  data?: AuthUser;
  error?: string;
  message?: string;
  status: number;
}

// Simple auth client
export class AuthClient {
  // Sign in with email/password (teachers/admins)
  static async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/sign-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        status: 500,
        error: 'Network error during sign in',
      };
    }
  }

  // Sign in with visual password (students)
  static async signInVisual(full_name: string, visual_password_id: string, class_access_token: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/sign-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ full_name, visual_password_id, class_access_token }),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        status: 500,
        error: 'Network error during visual sign in',
      };
    }
  }

  // Sign up new user
  static async signUp(userData: {
    email: string;
    password?: string;
    full_name: string;
    role: 'student' | 'teacher' | 'admin';
    username?: string;
    class_id?: string;
    visual_password_id?: string;
    class_access_token?: string;
  }): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/sign-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(userData),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        status: 500,
        error: 'Network error during sign up',
      };
    }
  }

  // Sign out
  static async signOut(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        status: 500,
        error: 'Network error during sign out',
      };
    }
  }

  // Get current session
  static async getSession(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/session`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        status: 500,
        error: 'Network error getting session',
      };
    }
  }
}

// Compatibility exports for existing code
export const signIn = AuthClient.signIn;
export const signUp = AuthClient.signUp;
export const signOut = AuthClient.signOut;
export const getSession = AuthClient.getSession;

// Simple session hook for React components
export function useSession() {
  // This would need to be implemented with React state management
  // For now, just return a placeholder
  return {
    data: null,
    loading: true,
    error: null
  };
}