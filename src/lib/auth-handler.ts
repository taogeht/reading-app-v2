import { betterAuth } from "better-auth";
import { getAuthConfig } from "./auth";

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

// Create auth instance on server-side only
let auth: any = null;

if (!isBrowser) {
  try {
    auth = betterAuth(getAuthConfig());
  } catch (error) {
    console.error("Failed to initialize auth on server-side:", error);
  }
}

// Handler for BetterAuth API routes
export async function authHandler(request: Request): Promise<Response> {
  if (isBrowser || !auth) {
    console.warn("Auth handler not available in browser environment");
    return new Response(JSON.stringify({ error: "Auth not available" }), { 
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const response = await auth.handler(request);
    return response;
  } catch (error) {
    console.error("Auth handler error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Middleware to get session from request
export async function getSessionFromRequest(request: Request) {
  if (isBrowser || !auth) {
    console.warn("Get session not available in browser environment");
    return null;
  }

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return session;
  } catch (error) {
    console.error("Get session error:", error);
    return null;
  }
}

// Helper to create an authenticated user
export async function createUser(email: string, password: string, userData: {
  username?: string;
  full_name?: string;
  role: "student" | "teacher" | "admin";
  class_id?: string;
}) {
  if (isBrowser || !auth) {
    console.warn("Create user not available in browser environment");
    throw new Error("Auth not available");
  }

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        ...userData,
      },
    });
    return result;
  } catch (error) {
    console.error("Create user error:", error);
    throw error;
  }
}

// Helper to sign in a user
export async function signInUser(email: string, password: string) {
  if (isBrowser || !auth) {
    console.warn("Sign in not available in browser environment");
    throw new Error("Auth not available");
  }

  try {
    const result = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });
    return result;
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  }
}

// Helper to update user profile
export async function updateUserProfile(userId: string, updates: {
  username?: string;
  full_name?: string;
  role?: "student" | "teacher" | "admin";
  class_id?: string;
}) {
  if (isBrowser || !auth) {
    console.warn("Update user profile not available in browser environment");
    throw new Error("Auth not available");
  }

  try {
    const result = await auth.api.updateUser({
      body: {
        userId,
        ...updates,
      },
    });
    return result;
  } catch (error) {
    console.error("Update user error:", error);
    throw error;
  }
}