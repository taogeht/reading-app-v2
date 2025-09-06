// Server-side only database connection
// This file should only be used in server-side contexts

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

let pool: any = null;

// Initialize database connection asynchronously 
async function initializeDatabase() {
  if (isBrowser || pool) return;
  
  try {
    // Dynamic import for ESM compatibility
    const pg = await import('pg');
    const { Pool } = pg.default || pg;
    
    // Check for required DATABASE_URL environment variable
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required for database connection');
    }

    // Database configuration
    const databaseConfig = {
      // Use DATABASE_URL from environment variables (Railway format)
      connectionString: process.env.DATABASE_URL,
      
      // Connection pool settings
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
      connectionTimeoutMillis: 2000, // Connection timeout
      
      // SSL configuration for production
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
    
    console.log('🔧 Database config:', {
      hasConnectionString: !!databaseConfig.connectionString,
      connectionStringPreview: databaseConfig.connectionString?.substring(0, 30) + '...'
    });

    // Create connection pool
    pool = new Pool(databaseConfig);
    console.log('✅ Database pool initialized successfully');
    
    // Handle pool errors
    pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.warn('Database connection only available server-side');
  }
}

// Only initialize database connection server-side
if (!isBrowser) {
  initializeDatabase();
}

export { pool };

// Handle pool errors (server-side only)
if (!isBrowser && pool) {
  pool.on('error', (err: Error) => {
    console.error('Unexpected error on idle client', err);
  });
}

// Database connection health check
export const testConnection = async (): Promise<boolean> => {
  if (isBrowser) {
    console.warn('testConnection not available in browser - using mock');
    return false;
  }
  
  if (!pool) {
    console.error('Database pool not initialized');
    return false;
  }
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Generic query function with error handling
export const query = async (text: string, params?: any[]) => {
  if (isBrowser) {
    console.warn('Database query not available in browser - using mock');
    return { rows: [], rowCount: 0 };
  }
  
  if (!pool) {
    console.error('Database pool not initialized');
    throw new Error('Database not available');
  }
  
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Query error:', { text, error });
    throw error;
  }
};

// Transaction helper
export const transaction = async (callback: (client: any) => Promise<any>) => {
  if (isBrowser) {
    console.warn('Database transaction not available in browser - using mock');
    return null;
  }
  
  if (!pool) {
    console.error('Database pool not initialized');
    throw new Error('Database not available');
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Graceful shutdown
export const closePool = async () => {
  if (isBrowser) {
    console.warn('closePool not available in browser');
    return;
  }
  
  if (!pool) {
    console.warn('Database pool not initialized');
    return;
  }
  
  await pool.end();
  console.log('Database pool closed');
};

// Database types that match our schema
export interface User {
  id: string;
  email: string;
  username?: string;
  full_name: string | null;
  role: 'student' | 'teacher' | 'admin';
  class_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  name: string;
  grade_level: number;
  teacher_id: string;
  school_year: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  story_id: string;
  story_title: string;
  class_id: string;
  teacher_id: string;
  due_date: string | null;
  instructions: string | null;
  max_attempts: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  student_id: string;
  assignment_id: string;
  attempt_number: number;
  audio_url: string;
  audio_filename: string;
  audio_size_bytes: number | null;
  audio_duration_seconds: number | null;
  transcript: string | null;
  feedback_data: any | null;
  accuracy_score: number | null;
  reading_pace: 'too-fast' | 'just-right' | 'too-slow' | null;
  word_count: number | null;
  correct_words: number | null;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  processing_started_at: string | null;
  processing_completed_at: string | null;
  error_message: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}