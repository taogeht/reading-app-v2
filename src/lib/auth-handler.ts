import { betterAuth } from "better-auth";
import { getAuthConfig } from "./auth";

// Create auth instance on server-side only
const auth = betterAuth(getAuthConfig());

// Handler for BetterAuth API routes
export async function authHandler(request: Request): Promise<Response> {
  try {
    const response = await auth.handler(request);
    return response;
  } catch (error) {
    console.error("Auth handler error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// Middleware to get session from request
export async function getSessionFromRequest(request: Request) {
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