import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// SECURITY: Service role key removed from frontend for security

if (!supabaseUrl) {
  throw new Error('Missing env.VITE_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing env.VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'reading-app-auth', // Use consistent storage key
    storage: window.localStorage,
  },
});

// SECURITY: Admin client removed from frontend for security
// Admin operations should be handled via backend API endpoints
export const supabaseAdmin = null;

// Database types for the application - matches the schema exactly
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: 'student' | 'teacher' | 'admin';
          class_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: 'student' | 'teacher' | 'admin';
          class_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: 'student' | 'teacher' | 'admin';
          class_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          name: string;
          grade_level: number;
          teacher_id: string;
          school_year: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          grade_level: number;
          teacher_id: string;
          school_year?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          grade_level?: number;
          teacher_id?: string;
          school_year?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      assignments: {
        Row: {
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
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          story_id: string;
          story_title: string;
          class_id: string;
          teacher_id: string;
          due_date?: string | null;
          instructions?: string | null;
          max_attempts?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          story_id?: string;
          story_title?: string;
          class_id?: string;
          teacher_id?: string;
          due_date?: string | null;
          instructions?: string | null;
          max_attempts?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      recordings: {
        Row: {
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
        };
        Insert: {
          id?: string;
          student_id: string;
          assignment_id: string;
          attempt_number?: number;
          audio_url: string;
          audio_filename: string;
          audio_size_bytes?: number | null;
          audio_duration_seconds?: number | null;
          transcript?: string | null;
          feedback_data?: any | null;
          accuracy_score?: number | null;
          reading_pace?: 'too-fast' | 'just-right' | 'too-slow' | null;
          word_count?: number | null;
          correct_words?: number | null;
          status?: 'uploaded' | 'processing' | 'completed' | 'failed';
          processing_started_at?: string | null;
          processing_completed_at?: string | null;
          error_message?: string | null;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          assignment_id?: string;
          attempt_number?: number;
          audio_url?: string;
          audio_filename?: string;
          audio_size_bytes?: number | null;
          audio_duration_seconds?: number | null;
          transcript?: string | null;
          feedback_data?: any | null;
          accuracy_score?: number | null;
          reading_pace?: 'too-fast' | 'just-right' | 'too-slow' | null;
          word_count?: number | null;
          correct_words?: number | null;
          status?: 'uploaded' | 'processing' | 'completed' | 'failed';
          processing_started_at?: string | null;
          processing_completed_at?: string | null;
          error_message?: string | null;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}