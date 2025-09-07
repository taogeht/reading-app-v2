// Users API routes
// Handles CRUD operations for teachers, students, and admin users

import { createApiResponse, ApiRequest } from '../index';
import { DatabaseService } from '../../lib/database-service';
import { SessionManager } from '../../lib/session-manager';

export interface CreateUserRequest {
  email?: string; // Optional for teachers (required for students/admins)
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  username: string; // Required for teachers, optional for students/admins
  password?: string; // For teachers/admins
  class_id?: string; // For students
  visual_password_id?: string; // For students with visual passwords
}

export interface UpdateUserRequest {
  email?: string;
  full_name?: string;
  username?: string;
  class_id?: string;
  is_active?: boolean;
}

// Main users request handler
export async function handleUsersRequest(request: ApiRequest, id?: string, subResource?: string): Promise<Response> {
  console.log('🔐 Users request received:', request.method, request.url, 'ID:', id, 'SubResource:', subResource);

  // Extract session token for authentication
  const sessionToken = SessionManager.extractSessionToken(request.headers);
  if (!sessionToken) {
    return new Response(
      JSON.stringify(createApiResponse(null, 'Authentication required', 401)),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Verify session and get user
  const sessionUser = SessionManager.getSession(sessionToken);
  if (!sessionUser) {
    return new Response(
      JSON.stringify(createApiResponse(null, 'Invalid or expired session', 401)),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check if user has admin privileges
  if (sessionUser.role !== 'admin') {
    return new Response(
      JSON.stringify(createApiResponse(null, 'Admin access required', 403)),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Route to appropriate handler based on method and path
  switch (request.method) {
    case 'GET':
      if (id) {
        return await handleGetUser(id);
      } else {
        return await handleGetUsers(request);
      }
    case 'POST':
      return await handleCreateUser(request);
    case 'PUT':
      if (id) {
        return await handleUpdateUser(id, request);
      } else {
        return new Response(
          JSON.stringify(createApiResponse(null, 'User ID required for update', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    case 'DELETE':
      if (id) {
        return await handleDeleteUser(id);
      } else {
        return new Response(
          JSON.stringify(createApiResponse(null, 'User ID required for deletion', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    default:
      return new Response(
        JSON.stringify(createApiResponse(null, 'Method not allowed', 405)),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
  }
}

// GET /api/users - List all users with optional filtering
async function handleGetUsers(request: ApiRequest): Promise<Response> {
  try {
    const role = request.query?.role as 'student' | 'teacher' | 'admin' | undefined;
    
    console.log('📋 Getting users list, role filter:', role);
    
    let users;
    if (role) {
      users = await DatabaseService.getUsersByRole(role);
    } else {
      users = await DatabaseService.getAllUsers();
    }

    console.log(`✅ Found ${users.length} users`);
    
    return new Response(
      JSON.stringify(createApiResponse(users, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error getting users:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to get users', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// GET /api/users/:id - Get specific user by ID
async function handleGetUser(id: string): Promise<Response> {
  try {
    console.log('👤 Getting user by ID:', id);
    
    const user = await DatabaseService.getUserById(id);
    if (!user) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'User not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Found user:', user.email);
    
    return new Response(
      JSON.stringify(createApiResponse(user, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error getting user:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to get user', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST /api/users - Create new user
async function handleCreateUser(request: ApiRequest): Promise<Response> {
  try {
    const userData: CreateUserRequest = request.body;
    console.log('➕ Creating new user:', userData.email, 'Role:', userData.role);

    // Validate required fields based on role
    if (!userData.full_name || !userData.role || !userData.username) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Missing required fields: full_name, role, username', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // For teachers: username is primary identifier, email is optional
    // For students/admins: email is still required
    if (userData.role !== 'teacher' && !userData.email) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Email is required for students and admins', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists (by username for teachers, by email for others)
    let existingUser;
    if (userData.role === 'teacher') {
      existingUser = await DatabaseService.getUserByUsername(userData.username);
      if (existingUser) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Teacher already exists with this username', 409)),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      existingUser = await DatabaseService.getUserByEmail(userData.email!);
      if (existingUser) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'User already exists with this email', 409)),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    let newUser;
    
    // Create user based on role
    if (userData.role === 'student') {
      // Students can be created without password (using visual passwords)
      newUser = await DatabaseService.createUserProfile({
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        username: userData.username,
        class_id: userData.class_id,
        visual_password_id: userData.visual_password_id,
      });
    } else {
      // Teachers and admins must have passwords
      if (!userData.password) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Password required for teachers and admins', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // For teachers, use username@mschool.com.tw as email if not provided
      const email = userData.email || (userData.role === 'teacher' ? `${userData.username}@mschool.com.tw` : '');
      
      newUser = await DatabaseService.createUserWithPassword({
        email,
        password: userData.password,
        full_name: userData.full_name,
        role: userData.role as 'teacher' | 'admin',
        username: userData.username,
      });
    }

    if (!newUser) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to create user', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User created successfully:', newUser.email);

    return new Response(
      JSON.stringify(createApiResponse(newUser, null, 201, 'User created successfully')),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error creating user:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to create user', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// PUT /api/users/:id - Update existing user
async function handleUpdateUser(id: string, request: ApiRequest): Promise<Response> {
  try {
    const updates: UpdateUserRequest = request.body;
    console.log('✏️ Updating user:', id, 'with updates:', Object.keys(updates));

    // Check if user exists
    const existingUser = await DatabaseService.getUserById(id);
    if (!existingUser) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'User not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updatedUser = await DatabaseService.updateUser(id, updates);
    if (!updatedUser) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to update user', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User updated successfully:', updatedUser.email);

    return new Response(
      JSON.stringify(createApiResponse(updatedUser, null, 200, 'User updated successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error updating user:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to update user', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// DELETE /api/users/:id - Delete user
async function handleDeleteUser(id: string): Promise<Response> {
  try {
    console.log('🗑️ Deleting user:', id);

    // Check if user exists
    const existingUser = await DatabaseService.getUserById(id);
    if (!existingUser) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'User not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const success = await DatabaseService.deleteUser(id);
    if (!success) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to delete user', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User deleted successfully:', existingUser.email);

    return new Response(
      JSON.stringify(createApiResponse(null, null, 200, 'User deleted successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to delete user', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}