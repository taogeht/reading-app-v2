import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: {
    provider: "pg",
    url: process.env.DATABASE_URL,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
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
        // Validate role values
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
  secret: process.env.BETTER_AUTH_SECRET || "32-character-random-secret-key",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5173",
  trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;