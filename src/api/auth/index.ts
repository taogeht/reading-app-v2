// Authentication API routes  
// Simple custom authentication for all user types (students, teachers, admins)

import { createApiResponse, ApiRequest } from '../index';
import { DatabaseService } from '../../lib/database-service';
import { SessionManager, UserSession } from '../../lib/session-manager';

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

// UserSession interface is now in session-manager.ts

// Handle authentication requests
export async function handleAuthRequest(request: ApiRequest): Promise<Response> {
  console.log('🔐 Auth request received:', request.method, request.url);
  
  // Parse endpoint from URL
  const pathParts = request.url.split('/').filter(Boolean);
  const endpoint = pathParts[pathParts.length - 1];
  console.log('🔄 Using custom authentication for endpoint:', endpoint);

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

    // Check if user already exists
    const existingUser = await DatabaseService.getUserByEmail(body.email);
    if (existingUser) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'User already exists with this email', 409)),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // For students with class access token, verify class exists
    if (body.role === 'student' && body.class_access_token) {
      const classInfo = await DatabaseService.getClassByAccessToken(body.class_access_token);
      if (!classInfo || !classInfo.allow_student_access) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Invalid class access code', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      body.class_id = classInfo.id; // Set the class_id from the access token
    }

    let userProfile;

    // Create user based on type
    if (body.role === 'student') {
      // Create student with visual password (existing method)
      userProfile = await DatabaseService.createUserProfile({
        email: body.email,
        full_name: body.full_name,
        role: body.role,
        username: body.username,
        class_id: body.class_id,
        visual_password_id: body.visual_password_id,
      });
    } else {
      // Create teacher/admin with password hash
      userProfile = await DatabaseService.createUserWithPassword({
        email: body.email,
        password: body.password!,
        full_name: body.full_name,
        role: body.role as 'teacher' | 'admin',
        username: body.username,
      });
    }

    if (!userProfile) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to create user profile', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create session for the new user
    const session = SessionManager.createSession(userProfile);

    const response = new Response(
      JSON.stringify(createApiResponse(session.user, null, 201, 'User created successfully')),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );

    // Set session cookie
    response.headers.set('Set-Cookie', `session_token=${session.sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`);

    return response;
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

    let userProfile;

    if (isVisualAuth) {
      // Student visual password authentication (existing custom flow)
      const authResult = await DatabaseService.authenticateStudentWithVisualPassword(
        body.class_access_token!,
        body.full_name!,
        body.visual_password_id!
      );

      if (!authResult.success || !authResult.user) {
        return new Response(
          JSON.stringify(createApiResponse(null, authResult.error || 'Student authentication failed', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      userProfile = authResult.user;
    } else {
      // Email/password authentication for teachers/admins
      console.log('🔄 Authenticating teacher/admin with email/password');
      
      userProfile = await DatabaseService.authenticateEmailPassword(body.email!, body.password!);
      
      if (!userProfile) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Invalid email or password', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create session for authenticated user
    const session = SessionManager.createSession(userProfile);

    const response = new Response(
      JSON.stringify(createApiResponse(session.user, null, 200, 'Authentication successful')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

    // Set session cookie
    response.headers.set('Set-Cookie', `session_token=${session.sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`);

    return response;
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
    // Extract session token and destroy session
    const sessionToken = SessionManager.extractSessionToken(request.headers);
    
    if (sessionToken) {
      SessionManager.destroySession(sessionToken);
      console.log('🔓 Session destroyed successfully');
    }

    const response = new Response(
      JSON.stringify(createApiResponse(null, null, 200, 'Signed out successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

    // Clear session cookie
    response.headers.set('Set-Cookie', 'session_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');

    return response;
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
    // Extract session token and get user session
    const sessionToken = SessionManager.extractSessionToken(request.headers);
    
    if (!sessionToken) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'No session token provided', 401)),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = SessionManager.getSession(sessionToken);
    
    if (!user) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Invalid or expired session', 401)),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(createApiResponse(user, null, 200)),
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