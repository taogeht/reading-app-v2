import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:5173",
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;