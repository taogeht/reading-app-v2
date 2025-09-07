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
    console.log('Available environment variables:', Object.keys(process.env).filter(key => 
      key.includes('DATABASE') || key.includes('AUTH') || key.includes('PG') || key.includes('POSTGRES')
    ));
    
    // Try to get database URL from various possible sources
    const databaseUrl = process.env.DATABASE_URL || 
                       process.env.POSTGRES_URL || 
                       process.env.DATABASE_PRIVATE_URL ||
                       `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;
    
    const betterAuthSecret = process.env.BETTER_AUTH_SECRET || 
                            process.env.AUTH_SECRET ||
                            '57f95202d0fef924e6e4b6ff1c0d3fffc55dd6d4312b61fcf6aa02cab528c506'; // Fallback
    
    const baseUrl = process.env.BETTER_AUTH_URL || 
                   process.env.RAILWAY_STATIC_URL || 
                   process.env.RAILWAY_PUBLIC_DOMAIN ||
                   'https://reading-app-v2-production.up.railway.app';
    
    console.log('Database URL present:', !!databaseUrl);
    console.log('Database URL preview:', databaseUrl.substring(0, 50) + '...');
    console.log('BetterAuth secret present:', !!betterAuthSecret);
    console.log('BetterAuth secret length:', betterAuthSecret.length);
    console.log('Base URL:', baseUrl);
    console.log('Node environment:', process.env.NODE_ENV);
    
    // Check if required environment variables are present
    if (!databaseUrl || databaseUrl === 'postgresql://undefined:undefined@undefined:undefined/undefined') {
      throw new Error('No valid DATABASE_URL found in environment variables');
    }
    
    // Ensure the DATABASE_URL includes SSL mode for Railway
    const finalDatabaseUrl = databaseUrl.includes('?sslmode=') 
      ? databaseUrl 
      : databaseUrl + '?sslmode=require';
    
    console.log('🔗 Using database URL with SSL:', finalDatabaseUrl.substring(0, 50) + '...');
    
    auth = betterAuth({
      database: {
        provider: "pg",
        url: finalDatabaseUrl,
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
      secret: betterAuthSecret,
      baseURL: baseUrl,
      trustedOrigins: [
        baseUrl,
        "https://reading-app-v2-production.up.railway.app",
        "http://localhost:5173", 
        "http://localhost:3000",
        "http://localhost:5174", // Vite preview port
      ].filter(Boolean),
    });
    
    console.log('✅ BetterAuth initialized successfully');
    
    // Test database connection
    try {
      console.log('🔍 Testing database connection...');
      // Try a simple database query to verify connection
      const testConnection = await import('pg').then(async (pg) => {
        const client = new pg.Client(finalDatabaseUrl);
        await client.connect();
        const result = await client.query('SELECT NOW() as current_time');
        await client.end();
        return result.rows[0];
      });
      console.log('✅ Database connection test successful:', testConnection.current_time);
    } catch (dbError) {
      console.error('❌ Database connection test failed:', dbError);
      console.error('Database error details:', dbError.message);
      console.error('Database error code:', dbError.code);
      // Don't fail initialization, but log the issue
    }
    
  } catch (error) {
    console.error('❌ BetterAuth initialization failed:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
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