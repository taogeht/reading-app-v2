// BetterAuth server configuration
// This handles the actual authentication logic server-side

import { betterAuth } from "better-auth";
import { pool } from "./database";

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

// Create BetterAuth instance only on server side
export const auth = isBrowser ? null : betterAuth({
  database: {
    provider: "pg",
    url: process.env.DATABASE_URL!,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        unique: true,
      },
      full_name: {
        type: "string", 
        required: false,
      },
      role: {
        type: "string",
        required: true,
        defaultValue: "student",
        validate: (value: string) => {
          return ["student", "teacher", "admin"].includes(value);
        },
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
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5173",
  trustedOrigins: [
    "http://localhost:5173", 
    "http://localhost:3000",
    "http://localhost:5174", // Vite preview port
    process.env.BETTER_AUTH_URL || "http://localhost:5173"
  ].filter(Boolean),
});

// Export auth handlers for API routes
export const { GET, POST } = auth?.handler || { GET: null, POST: null };

// Helper function to get auth instance (with null check)
export function getAuth() {
  if (isBrowser) {
    throw new Error('BetterAuth server instance should not be accessed in browser');
  }
  if (!auth) {
    throw new Error('BetterAuth instance not initialized');
  }
  return auth;
}