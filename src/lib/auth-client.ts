import { createAuthClient } from "better-auth/react";

// Create auth client with error handling
let authClient: any = null;
let authError: Error | null = null;

try {
  authClient = createAuthClient({
    baseURL: import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:5173",
  });
} catch (error) {
  console.error("Failed to create auth client:", error);
  authError = error as Error;
  // Create mock auth client to prevent undefined function errors
  authClient = {
    signIn: { email: () => Promise.resolve({ error: new Error("Auth not available") }) },
    signUp: { email: () => Promise.resolve({ error: new Error("Auth not available") }) },
    signOut: () => Promise.resolve({ error: null }),
    useSession: () => ({ data: null, isPending: false }),
    getSession: () => Promise.resolve(null),
  };
}

// Export functions with fallbacks
export const signIn = authClient?.signIn || {
  email: () => {
    console.warn("signIn.email not available - auth client failed to initialize");
    return Promise.resolve({ error: new Error("Auth not available") });
  }
};

export const signUp = authClient?.signUp || {
  email: () => {
    console.warn("signUp.email not available - auth client failed to initialize");
    return Promise.resolve({ error: new Error("Auth not available") });
  }
};

export const signOut = authClient?.signOut || (() => {
  console.warn("signOut not available - auth client failed to initialize");
  return Promise.resolve({ error: null });
});

export const useSession = authClient?.useSession || (() => {
  console.warn("useSession not available - auth client failed to initialize");
  return { data: null, isPending: false };
});

export const getSession = authClient?.getSession || (() => {
  console.warn("getSession not available - auth client failed to initialize");
  return Promise.resolve(null);
});

export { authClient };