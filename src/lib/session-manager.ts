// Simple session management for custom authentication
// Server-side only - handles session tokens and user sessions

import { randomUUID } from 'crypto';
import { DatabaseUserProfile } from './database-service';

export interface UserSession {
  id: string;
  email: string;
  username?: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  class_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SessionData {
  sessionToken: string;
  user: UserSession;
  createdAt: Date;
  expiresAt: Date;
}

// In-memory session store (you could replace with Redis/database for production)
const sessions = new Map<string, SessionData>();

// Session configuration
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export class SessionManager {
  // Create a new session for a user
  static createSession(user: DatabaseUserProfile): SessionData {
    const sessionToken = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION);

    const userSession: UserSession = {
      id: user.id,
      email: user.email,
      username: user.username || user.email.split('@')[0],
      full_name: user.full_name || '',
      role: user.role,
      class_id: user.class_id,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    const sessionData: SessionData = {
      sessionToken,
      user: userSession,
      createdAt: now,
      expiresAt,
    };

    sessions.set(sessionToken, sessionData);
    
    // Clean up expired sessions periodically
    this.cleanupExpiredSessions();
    
    return sessionData;
  }

  // Get session by token
  static getSession(sessionToken: string): UserSession | null {
    const sessionData = sessions.get(sessionToken);
    
    if (!sessionData) {
      return null;
    }

    // Check if session is expired
    if (new Date() > sessionData.expiresAt) {
      sessions.delete(sessionToken);
      return null;
    }

    return sessionData.user;
  }

  // Destroy a session
  static destroySession(sessionToken: string): boolean {
    return sessions.delete(sessionToken);
  }

  // Clean up expired sessions
  static cleanupExpiredSessions(): void {
    const now = new Date();
    
    for (const [token, sessionData] of sessions.entries()) {
      if (now > sessionData.expiresAt) {
        sessions.delete(token);
      }
    }
  }

  // Get all active sessions count (for debugging)
  static getActiveSessionsCount(): number {
    this.cleanupExpiredSessions();
    return sessions.size;
  }

  // Extract session token from request headers
  static extractSessionToken(headers: Headers | Record<string, string>): string | null {
    // Try Authorization header first
    let authHeader: string | null = null;
    
    if (headers instanceof Headers) {
      authHeader = headers.get('authorization');
    } else {
      authHeader = headers.authorization || headers.Authorization;
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookie as fallback
    let cookieHeader: string | null = null;
    
    if (headers instanceof Headers) {
      cookieHeader = headers.get('cookie');
    } else {
      cookieHeader = headers.cookie || headers.Cookie;
    }

    if (cookieHeader) {
      const sessionMatch = cookieHeader.match(/session_token=([^;]+)/);
      if (sessionMatch) {
        return sessionMatch[1];
      }
    }

    return null;
  }
}