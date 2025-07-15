// Authentication API routes
// Unified authentication for all user types (students, teachers, admins)

import { createApiResponse, ApiRequest } from '../index';

export interface SignUpRequest {
  email: string;
  password?: string; // Optional for visual password students
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  username?: string;
  class_id?: string;
  visual_password_id?: string; // For student visual authentication
  class_access_token?: string; // For student class access
}

export interface SignInRequest {
  email?: string;
  password?: string;
  // Visual password login
  full_name?: string;
  visual_password_id?: string;
  class_access_token?: string;
}

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

// Handle authentication requests
export async function handleAuthRequest(request: ApiRequest): Promise<Response> {
  const pathParts = request.url.split('/').filter(Boolean);
  const endpoint = pathParts[pathParts.length - 1];

  switch (request.method) {
    case 'POST':
      switch (endpoint) {
        case 'sign-up':
          return await handleSignUp(request);
        case 'sign-in':
          return await handleSignIn(request);
        case 'sign-out':
          return await handleSignOut(request);
        case 'forgot-password':
          return await handleForgotPassword(request);
        default:
          return new Response(
            JSON.stringify(createApiResponse(null, 'Auth endpoint not found', 404)),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
      }
    case 'GET':
      switch (endpoint) {
        case 'session':
          return await handleGetSession(request);
        default:
          return new Response(
            JSON.stringify(createApiResponse(null, 'Auth endpoint not found', 404)),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
      }
    default:
      return new Response(
        JSON.stringify(createApiResponse(null, 'Method not allowed', 405)),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
  }
}

async function handleSignUp(request: ApiRequest): Promise<Response> {
  try {
    const body: SignUpRequest = request.body;

    // Validate required fields
    if (!body.email || !body.full_name || !body.role) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Missing required fields', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Different validation for different user types
    if (body.role === 'student') {
      // Students can use visual password OR email/password
      if (!body.visual_password_id && !body.password) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Students must have either visual password or email password', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Students must have class access
      if (!body.class_access_token && !body.class_id) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Students must be assigned to a class', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Teachers and admins must have email/password
      if (!body.password) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Password required for teachers and admins', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // TODO: Implement actual user creation with BetterAuth
    console.warn('Sign up not fully implemented - using mock response');

    const mockUser: UserSession = {
      id: `mock-${Date.now()}`,
      email: body.email,
      username: body.username || body.email.split('@')[0],
      full_name: body.full_name,
      role: body.role,
      class_id: body.class_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(createApiResponse(mockUser, null, 201, 'User created successfully')),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sign up error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to create user', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleSignIn(request: ApiRequest): Promise<Response> {
  try {
    const body: SignInRequest = request.body;

    // Determine authentication method
    const isVisualAuth = body.visual_password_id && body.full_name && body.class_access_token;
    const isEmailAuth = body.email && body.password;

    if (!isVisualAuth && !isEmailAuth) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Invalid authentication credentials', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Implement actual authentication with BetterAuth
    console.warn('Sign in not fully implemented - using mock response');

    const mockUser: UserSession = {
      id: 'mock-user-id',
      email: body.email || `${body.full_name?.toLowerCase().replace(/\s+/g, '.')}@student.local`,
      username: body.email?.split('@')[0] || body.full_name?.toLowerCase().replace(/\s+/g, ''),
      full_name: body.full_name || 'Mock User',
      role: isVisualAuth ? 'student' : 'teacher',
      class_id: isVisualAuth ? 'mock-class-id' : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(createApiResponse(mockUser, null, 200, 'Authentication successful')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sign in error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Authentication failed', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleSignOut(request: ApiRequest): Promise<Response> {
  try {
    // TODO: Implement actual session invalidation with BetterAuth
    console.warn('Sign out not fully implemented - using mock response');

    return new Response(
      JSON.stringify(createApiResponse(null, null, 200, 'Signed out successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sign out error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to sign out', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGetSession(request: ApiRequest): Promise<Response> {
  try {
    // TODO: Implement actual session retrieval with BetterAuth
    console.warn('Get session not fully implemented - using mock response');

    // Check for authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'No active session', 401)),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const mockUser: UserSession = {
      id: 'mock-user-id',
      email: 'mock@example.com',
      username: 'mockuser',
      full_name: 'Mock User',
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(createApiResponse(mockUser, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get session error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to get session', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleForgotPassword(request: ApiRequest): Promise<Response> {
  try {
    const { email } = request.body;

    if (!email) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Email required', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Implement actual password reset with BetterAuth
    console.warn('Forgot password not fully implemented - using mock response');

    return new Response(
      JSON.stringify(createApiResponse(null, null, 200, 'Password reset email sent')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to process password reset', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}