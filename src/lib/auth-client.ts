import { createAuthClient } from "better-auth/react";

// Create auth client with proper configuration
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL || "https://reading-app-v2-production.up.railway.app",
  fetchOptions: {
    headers: {
      'Content-Type': 'application/json'
    }
  }
});

// Export auth functions directly from the client
export const { 
  signIn, 
  signUp, 
  signOut, 
  useSession, 
  getSession
} = authClient;