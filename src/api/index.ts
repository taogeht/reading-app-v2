// Main API route handler for unified authentication and data access
// This replaces the direct database access pattern with secure server-side APIs

import { getAuthConfig } from '../lib/auth';
import { pool } from '../lib/database';

// Types for API responses
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

export interface ApiRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

// Middleware for authentication check
export async function requireAuth(request: ApiRequest): Promise<{ user: any; error?: string }> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }

  // TODO: Implement actual session verification with BetterAuth
  // For now, return mock user for development
  console.warn('requireAuth not fully implemented - using mock user');
  
  return {
    user: {
      id: 'mock-user-id',
      email: 'mock@example.com',
      role: 'admin'
    }
  };
}

// Middleware for role-based access control
export function requireRole(allowedRoles: string[]) {
  return async (request: ApiRequest, user: any): Promise<{ authorized: boolean; error?: string }> => {
    if (!user) {
      return { authorized: false, error: 'Authentication required' };
    }

    if (!allowedRoles.includes(user.role)) {
      return { authorized: false, error: 'Insufficient permissions' };
    }

    return { authorized: true };
  };
}

// Utility to create standardized API responses
export function createApiResponse<T>(
  data?: T,
  error?: string,
  status: number = 200,
  message?: string
): ApiResponse<T> {
  return {
    data,
    error,
    message,
    status
  };
}

// Utility to parse request URL and extract params
export function parseApiRequest(url: string, method: string, headers: Record<string, string>, body?: any): ApiRequest {
  const urlObj = new URL(url, 'http://localhost');
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  
  // Remove 'api' from path
  if (pathParts[0] === 'api') {
    pathParts.shift();
  }

  const params: Record<string, string> = {};
  const query: Record<string, string> = {};

  // Parse query parameters
  urlObj.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return {
    method,
    url: urlObj.pathname,
    headers,
    body,
    params,
    query
  };
}

// Main API router function
export async function handleApiRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const method = request.method;
    console.log('API request:', method, url.pathname);
    
    const headers: Record<string, string> = {};
    
    // Convert Headers to plain object
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = await request.json();
        console.log('Request body:', body);
      } catch {
        // Body might not be JSON, that's ok
        console.log('No JSON body or failed to parse');
      }
    }

    const apiRequest = parseApiRequest(url.href, method, headers, body);
    const pathParts = url.pathname.split('/').filter(Boolean);
    console.log('Path parts:', pathParts);
    
    // Remove 'api' from path
    if (pathParts[0] === 'api') {
      pathParts.shift();
    }
    console.log('Path parts after removing api:', pathParts);

    const [resource, id, subResource] = pathParts;
    console.log('Routing to resource:', resource, 'with id:', id, 'subResource:', subResource);

    // Route to appropriate handlers
    switch (resource) {
      case 'ping':
        return new Response(
          JSON.stringify(createApiResponse({ message: 'pong', timestamp: new Date().toISOString() }, null, 200)),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      case 'health':
        return await handleHealthRequest(apiRequest);
      case 'auth':
        try {
          console.log('🔐 About to handle auth request');
          return await handleAuthRequest(apiRequest);
        } catch (error) {
          console.error('🔐 Auth handler error:', error);
          return new Response(
            JSON.stringify(createApiResponse(null, `Auth handler failed: ${error.message}`, 500)),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      case 'users':
        return await handleUsersRequest(apiRequest, id, subResource);
      case 'classes':
        return await handleClassesRequest(apiRequest, id, subResource);
      case 'assignments':
        return await handleAssignmentsRequest(apiRequest, id, subResource);
      case 'recordings':
        return await handleRecordingsRequest(apiRequest, id, subResource);
      case 'visual-passwords':
        return await handleVisualPasswordsRequest(apiRequest);
      default:
        return new Response(
          JSON.stringify(createApiResponse(null, 'API endpoint not found', 404)),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('API request error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Internal server error', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Import route handlers
import { handleAuthRequest as authHandler } from './auth/index';
import { handleUsersRequest as usersHandler } from './users/index';
import { handleVisualPasswordsRequest as visualPasswordsHandler } from './visual-passwords/index';
import { handleClassesRequest as classesHandler } from './classes/index';
import { handleRecordingsRequest as recordingsHandler } from './recordings/index';

// Route handlers
async function handleHealthRequest(request: ApiRequest): Promise<Response> {
  try {
    console.log('🏥 Health check requested');
    
    // Check custom authentication status
    const { SessionManager } = await import('../lib/session-manager');
    const activeSessionsCount = SessionManager.getActiveSessionsCount();
    
    // Try a basic database connection test
    let dbStatus = 'unknown';
    let dbError = null;
    try {
      const pg = await import('pg');
      const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      const client = new pg.Client(dbUrl);
      await client.connect();
      await client.query('SELECT NOW()');
      await client.end();
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'failed';
      dbError = error.message;
    }

    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasDbUrl: !!process.env.DATABASE_URL,
      },
      services: {
        authentication: {
          type: 'custom',
          activeSessions: activeSessionsCount
        },
        database: {
          status: dbStatus,
          error: dbError
        }
      }
    };

    console.log('🏥 Health check response:', JSON.stringify(healthData, null, 2));

    return new Response(
      JSON.stringify(createApiResponse(healthData, null, 200, 'Health check completed')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('🏥 Health check failed:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, `Health check failed: ${error.message}`, 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleAuthRequest(request: ApiRequest): Promise<Response> {
  return await authHandler(request);
}

async function handleUsersRequest(request: ApiRequest, id?: string, subResource?: string): Promise<Response> {
  return await usersHandler(request, id, subResource);
}

async function handleClassesRequest(request: ApiRequest, id?: string, subResource?: string): Promise<Response> {
  return await classesHandler(request);
}

async function handleAssignmentsRequest(request: ApiRequest, id?: string, subResource?: string): Promise<Response> {
  // TODO: Implement in separate assignments routes file
  return new Response(
    JSON.stringify(createApiResponse(null, 'Assignments endpoints not implemented yet', 501)),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleRecordingsRequest(request: ApiRequest, id?: string, subResource?: string): Promise<Response> {
  return await recordingsHandler(request);
}

async function handleVisualPasswordsRequest(request: ApiRequest): Promise<Response> {
  return await visualPasswordsHandler(request);
}