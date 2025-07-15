// This file should only be used server-side
// Move to a separate server-only configuration

export const getAuthConfig = () => {
  // This ensures it only runs server-side
  if (typeof window !== 'undefined') {
    throw new Error('Auth config should only be used server-side');
  }
  
  return {
    database: {
      provider: "pg" as const,
      url: process.env.DATABASE_URL,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        username: {
          type: "string" as const,
          required: false,
          unique: true,
        },
        full_name: {
          type: "string" as const, 
          required: false,
        },
        role: {
          type: "string" as const,
          required: true,
          defaultValue: "student",
          validate: (value: string) => {
            return ["student", "teacher", "admin"].includes(value);
          },
        },
        class_id: {
          type: "string" as const,
          required: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 24 hours
    },
    secret: process.env.BETTER_AUTH_SECRET || "32-character-random-secret-key",
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5173",
    trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],
  };
};

// Types for client-side use
export type Session = {
  user: {
    id: string;
    email: string;
    username?: string;
    full_name: string | null;
    role: 'student' | 'teacher' | 'admin';
    class_id: string | null;
    createdAt: string;
    updatedAt: string;
  };
  session: {
    id: string;
    expiresAt: string;
    token: string;
    ipAddress?: string;
    userAgent?: string;
  };
};

export type User = Session['user'];