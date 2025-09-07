// BetterAuth server configuration
// This handles the actual authentication logic server-side

import { betterAuth } from "better-auth";

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

// Initialize BetterAuth with error handling
let auth = null;
let authError = null;

if (!isBrowser) {
  try {
    console.log('🔐 Initializing BetterAuth server...');
    console.log('Database URL present:', !!process.env.DATABASE_URL);
    console.log('BetterAuth secret present:', !!process.env.BETTER_AUTH_SECRET);
    console.log('Base URL:', process.env.BETTER_AUTH_URL);
    
    auth = betterAuth({
      database: {
        provider: "pg",
        url: process.env.DATABASE_URL!,
      },
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        sendEmailVerificationOnSignUp: false,
      },
      user: {
        additionalFields: {
          username: {
            type: "string",
            required: false,
            unique: false, // Allow non-unique for flexibility
          },
          full_name: {
            type: "string", 
            required: false,
          },
          role: {
            type: "string",
            required: true,
            defaultValue: "student",
          },
          class_id: {
            type: "string",
            required: false,
          },
        },
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 24 hours
      },
      secret: process.env.BETTER_AUTH_SECRET!,
      baseURL: process.env.BETTER_AUTH_URL || "https://reading-app-v2-production.up.railway.app",
      trustedOrigins: [
        "https://reading-app-v2-production.up.railway.app",
        "http://localhost:5173", 
        "http://localhost:3000",
        "http://localhost:5174", // Vite preview port
        process.env.BETTER_AUTH_URL || "https://reading-app-v2-production.up.railway.app"
      ].filter(Boolean),
    });
    
    console.log('✅ BetterAuth initialized successfully');
  } catch (error) {
    console.error('❌ BetterAuth initialization failed:', error);
    authError = error;
    auth = null;
  }
}

export { auth };

// Export auth handlers for API routes
export const { GET, POST } = auth?.handler || { GET: null, POST: null };

// Helper function to get auth instance (with null check)
export function getAuth() {
  if (isBrowser) {
    throw new Error('BetterAuth server instance should not be accessed in browser');
  }
  if (!auth) {
    const errorMessage = authError 
      ? `BetterAuth failed to initialize: ${authError.message}`
      : 'BetterAuth instance not initialized';
    throw new Error(errorMessage);
  }
  return auth;
}

// Helper function to check if auth is available
export function isAuthAvailable(): boolean {
  return !isBrowser && auth !== null;
}

// Get initialization error if any
export function getAuthError(): Error | null {
  return authError;
}