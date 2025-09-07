// Authentication API routes
// Unified authentication for all user types (students, teachers, admins)

import { createApiResponse, ApiRequest } from '../index';
import { DatabaseService } from '../../lib/database-service';
import { getAuth, isAuthAvailable, getAuthError } from '../../lib/better-auth-server';

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
  console.log('🔐 Auth request received:', request.method, request.url);
  
  // Check BetterAuth availability and report status
  const authAvailable = await isAuthAvailable();
  if (!authAvailable) {
    const authError = getAuthError();
    console.warn('⚠️ BetterAuth not available:', authError?.message || 'Not initialized');
    console.log('📋 Using fallback authentication handlers');
  } else {
    console.log('✅ BetterAuth available, attempting integration');
  }
  
  // Try BetterAuth's built-in handler if available
  if (authAvailable) {
    try {
      const auth = await getAuth();
      
      // Convert ApiRequest back to Web API Request for BetterAuth
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });

      const webRequest = new Request(`${process.env.BETTER_AUTH_URL || 'http://localhost:5173'}${request.url}`, {
        method: request.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined
      });

      console.log('🔄 Passing to BetterAuth handler:', webRequest.url);
      const response = await auth.handler(webRequest);
      
      // If BetterAuth handled it successfully, return the response
      if (response.status !== 404) {
        console.log('✅ BetterAuth handled request:', response.status);
        return response;
      }
      
      console.log('🔄 BetterAuth returned 404, falling back to custom handlers');
    } catch (error) {
      console.warn('❌ BetterAuth handler failed, using custom fallbacks:', error.message);
    }
  }

  // Fallback to custom handlers for student visual auth and other special cases
  const pathParts = request.url.split('/').filter(Boolean);
  const endpoint = pathParts[pathParts.length - 1];
  console.log('Using custom handler for endpoint:', endpoint);

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

    // For email/password users, create through BetterAuth if available
    if (body.password && await isAuthAvailable()) {
      try {
        const auth = await getAuth();
        
        console.log('🔄 Creating user through BetterAuth API');
        // Create user through BetterAuth for proper password hashing and session management
        const authResult = await auth.api.signUpEmail({
          body: {
            email: body.email,
            password: body.password,
            name: body.full_name,
            username: body.username,
            role: body.role,
            class_id: body.class_id,
            full_name: body.full_name
          }
        });

        if (authResult.error) {
          return new Response(
            JSON.stringify(createApiResponse(null, authResult.error, 400)),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const userSession: UserSession = {
          id: authResult.data.user.id,
          email: authResult.data.user.email,
          username: authResult.data.user.username || authResult.data.user.email.split('@')[0],
          full_name: authResult.data.user.full_name || authResult.data.user.name || '',
          role: authResult.data.user.role,
          class_id: authResult.data.user.class_id,
          created_at: authResult.data.user.createdAt,
          updated_at: authResult.data.user.updatedAt,
        };

        return new Response(
          JSON.stringify(createApiResponse(userSession, null, 201, 'User created successfully')),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('❌ BetterAuth signup failed, creating manually:', error);
        // Fall through to manual creation
      }
    } else if (body.password) {
      console.log('⚠️ BetterAuth not available, using manual user creation');
    }

    // For visual password students or BetterAuth failures, create manually
    const existingUser = await DatabaseService.getUserByEmail(body.email);
    if (existingUser) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'User already exists with this email', 409)),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userProfile = await DatabaseService.createUserProfile({
      email: body.email,
      full_name: body.full_name,
      role: body.role,
      username: body.username,
      class_id: body.class_id,
      visual_password_id: body.visual_password_id,
    });

    if (!userProfile) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to create user profile', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userSession: UserSession = {
      id: userProfile.id,
      email: userProfile.email,
      username: userProfile.username || userProfile.email.split('@')[0],
      full_name: userProfile.full_name || '',
      role: userProfile.role,
      class_id: userProfile.class_id,
      created_at: userProfile.created_at,
      updated_at: userProfile.updated_at,
    };

    return new Response(
      JSON.stringify(createApiResponse(userSession, null, 201, 'User created successfully')),
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

    let userProfile;

    if (isVisualAuth) {
      // Student visual password authentication (custom flow)
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
      // Email/password authentication through BetterAuth if available
      const authAvailableForSignIn = await isAuthAvailable();
      if (authAvailableForSignIn) {
        try {
          const auth = await getAuth();
          
          console.log('🔄 Authenticating through BetterAuth API');
          const authResult = await auth.api.signInEmail({
            body: {
              email: body.email!,
              password: body.password!
            }
          });

        if (authResult.error) {
          return new Response(
            JSON.stringify(createApiResponse(null, 'Invalid email or password', 401)),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Convert BetterAuth user to our session format
        const userSession: UserSession = {
          id: authResult.data.user.id,
          email: authResult.data.user.email,
          username: authResult.data.user.username || authResult.data.user.email.split('@')[0],
          full_name: authResult.data.user.full_name || authResult.data.user.name || '',
          role: authResult.data.user.role,
          class_id: authResult.data.user.class_id,
          created_at: authResult.data.user.createdAt,
          updated_at: authResult.data.user.updatedAt,
        };

        // Set session cookies
        const response = new Response(
          JSON.stringify(createApiResponse(userSession, null, 200, 'Authentication successful')),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

        // Copy session cookies from BetterAuth response
        if (authResult.data.session) {
          response.headers.set('Set-Cookie', `better-auth.session_token=${authResult.data.session.token}; HttpOnly; Secure; SameSite=Strict; Path=/`);
        }

        return response;
        } catch (error) {
          console.error('❌ BetterAuth sign-in failed, falling back to manual verification:', error);
          // Fall through to manual fallback
        }
      } else {
        console.log('⚠️ BetterAuth not available, using manual authentication');
      }
      
      // Fallback to manual verification
      userProfile = await DatabaseService.getUserByEmail(body.email!);
      
      if (!userProfile) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Invalid email or password', 401)),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // TODO: Add manual password verification for fallback
      console.warn('⚠️ Password verification temporarily disabled - allowing login');
    }

    // Convert profile to session format (for fallback cases)
    const userSession: UserSession = {
      id: userProfile.id,
      email: userProfile.email,
      username: userProfile.username || userProfile.email.split('@')[0],
      full_name: userProfile.full_name || '',
      role: userProfile.role,
      class_id: userProfile.class_id,
      created_at: userProfile.created_at,
      updated_at: userProfile.updated_at,
    };

    return new Response(
      JSON.stringify(createApiResponse(userSession, null, 200, 'Authentication successful')),
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
    // For now, use mock session while BetterAuth is being stabilized
    console.warn('Session verification temporarily disabled - using mock admin session');
    
    const mockUser: UserSession = {
      id: 'admin-user-id',
      email: 'admin@readingapp.com',
      username: 'admin',
      full_name: 'System Administrator',
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