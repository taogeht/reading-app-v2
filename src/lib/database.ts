import { Pool, PoolConfig } from 'pg';

// Database configuration
const databaseConfig: PoolConfig = {
  // Use DATABASE_URL if available (Railway format)
  connectionString: import.meta.env.DATABASE_URL,
  // Fallback to individual variables
  host: import.meta.env.PGHOST || 'localhost',
  port: parseInt(import.meta.env.PGPORT || '5432'),
  database: import.meta.env.PGDATABASE || 'reading_app',
  user: import.meta.env.PGUSER || 'postgres',
  password: import.meta.env.PGPASSWORD || '',
  
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // Connection timeout
  
  // SSL configuration for production
  ssl: import.meta.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Create connection pool
export const pool = new Pool(databaseConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Database connection health check
export const testConnection = async (): Promise<boolean> => {
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