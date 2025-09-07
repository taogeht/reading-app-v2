// Classes API routes
// Handles class management for teachers and admins

import { createApiResponse, ApiRequest } from '../index';
import { DatabaseService } from '../../lib/database-service';
import { SessionManager } from '../../lib/session-manager';

export interface ClassInfo {
  id: string;
  name: string;
  grade_level: number;
  teacher_id: string;
  access_token: string;
  allow_student_access: boolean;
  school_year: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateClassRequest {
  name: string;
  grade_level: number;
  school_year?: string;
  description?: string;
  allow_student_access?: boolean;
}

export interface UpdateClassRequest {
  name?: string;
  grade_level?: number;
  school_year?: string;
  description?: string;
  allow_student_access?: boolean;
  is_active?: boolean;
}

// Handle class requests
export async function handleClassesRequest(request: ApiRequest, id?: string, subResource?: string): Promise<Response> {
  console.log('🏫 Classes request received:', request.method, request.url, 'ID:', id, 'SubResource:', subResource);

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

  switch (request.method) {
    case 'GET':
      if (id && subResource === 'students') {
        // Handle GET /api/classes/:id/students
        return await handleGetClassStudents(id, sessionUser);
      } else if (id) {
        return await handleGetClass(request, id, sessionUser);
      } else if (request.query?.access_token) {
        // Handle GET /api/classes/students?access_token=... (no auth required for student login)
        return await handleGetStudentsByAccessToken(request);
      } else {
        return await handleGetClasses(request, sessionUser);
      }
    case 'POST':
      // Only teachers and admins can create classes
      if (sessionUser.role !== 'teacher' && sessionUser.role !== 'admin') {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Only teachers and admins can create classes', 403)),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return await handleCreateClass(request, sessionUser);
    case 'PUT':
      if (id) {
        return await handleUpdateClass(request, id, sessionUser);
      } else {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Class ID required for update', 400)),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    case 'DELETE':
      if (id) {
        return await handleDeleteClass(request, id, sessionUser);
      } else {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Class ID required for deletion', 400)),
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

async function handleGetClasses(request: ApiRequest, sessionUser: any): Promise<Response> {
  try {
    console.log('📋 Getting classes list for user:', sessionUser.role, sessionUser.id);
    
    let classes;
    
    if (sessionUser.role === 'admin') {
      // Admins can see all classes
      classes = await DatabaseService.getAllClasses();
    } else if (sessionUser.role === 'teacher') {
      // Teachers can only see their own classes
      classes = await DatabaseService.getClassesByTeacher(sessionUser.id);
    } else {
      // Students can only see their assigned class
      if (sessionUser.class_id) {
        const studentClass = await DatabaseService.getClassById(sessionUser.class_id);
        classes = studentClass ? [studentClass] : [];
      } else {
        classes = [];
      }
    }

    console.log(`✅ Found ${classes.length} classes for ${sessionUser.role}`);

    return new Response(
      JSON.stringify(createApiResponse(classes, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error getting classes:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to get classes', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGetClass(request: ApiRequest, classId: string, sessionUser: any): Promise<Response> {
  try {
    console.log('🏫 Getting class by ID:', classId, 'for user:', sessionUser.role);
    
    const classInfo = await DatabaseService.getClassById(classId);
    if (!classInfo) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Class not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check access permissions
    if (sessionUser.role === 'student') {
      // Students can only access their assigned class
      if (sessionUser.class_id !== classId) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Access denied', 403)),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (sessionUser.role === 'teacher') {
      // Teachers can only access their own classes
      if (classInfo.teacher_id !== sessionUser.id) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Access denied', 403)),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    // Admins can access any class

    console.log('✅ Found class:', classInfo.name);

    return new Response(
      JSON.stringify(createApiResponse(classInfo, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error getting class:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to get class', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleCreateClass(request: ApiRequest, sessionUser: any): Promise<Response> {
  try {
    const body: CreateClassRequest = request.body;
    console.log('➕ Creating new class:', body.name, 'for user:', sessionUser.id);

    // Validate required fields
    if (!body.name || !body.grade_level) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Missing required fields: name, grade_level', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate grade level
    if (body.grade_level < 1 || body.grade_level > 12) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Grade level must be between 1 and 12', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // For teachers, they create classes for themselves
    // For admins, they could specify teacher_id in future (not implemented yet)
    const teacherId = sessionUser.role === 'teacher' ? sessionUser.id : sessionUser.id;

    const newClass = await DatabaseService.createClass({
      name: body.name,
      grade_level: body.grade_level,
      teacher_id: teacherId,
      school_year: body.school_year || null,
      description: body.description || null,
      is_active: true,
      allow_student_access: body.allow_student_access !== false, // default true
    });

    if (!newClass) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to create class', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Class created successfully:', newClass.name);

    return new Response(
      JSON.stringify(createApiResponse(newClass, null, 201, 'Class created successfully')),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error creating class:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to create class', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleUpdateClass(request: ApiRequest, classId: string, sessionUser: any): Promise<Response> {
  try {
    const updates: UpdateClassRequest = request.body;
    console.log('✏️ Updating class:', classId, 'with updates:', Object.keys(updates));

    // Check if class exists and user has permission
    const existingClass = await DatabaseService.getClassById(classId);
    if (!existingClass) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Class not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check permissions
    if (sessionUser.role === 'teacher' && existingClass.teacher_id !== sessionUser.id) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'You can only update your own classes', 403)),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate grade level if provided
    if (updates.grade_level && (updates.grade_level < 1 || updates.grade_level > 12)) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Grade level must be between 1 and 12', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updatedClass = await DatabaseService.updateClass(classId, updates);
    if (!updatedClass) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to update class', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Class updated successfully:', updatedClass.name);

    return new Response(
      JSON.stringify(createApiResponse(updatedClass, null, 200, 'Class updated successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error updating class:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to update class', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleDeleteClass(request: ApiRequest, classId: string, sessionUser: any): Promise<Response> {
  try {
    console.log('🗑️ Deleting class:', classId, 'by user:', sessionUser.role);

    // Check if class exists and user has permission
    const existingClass = await DatabaseService.getClassById(classId);
    if (!existingClass) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Class not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check permissions
    if (sessionUser.role === 'teacher' && existingClass.teacher_id !== sessionUser.id) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'You can only delete your own classes', 403)),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const success = await DatabaseService.deleteClass(classId);
    if (!success) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to delete class', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Class deleted successfully:', existingClass.name);

    return new Response(
      JSON.stringify(createApiResponse(null, null, 200, 'Class deleted successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error deleting class:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to delete class', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// GET /api/classes/:id/students - Get students in a specific class
async function handleGetClassStudents(classId: string, sessionUser: any): Promise<Response> {
  try {
    console.log('👥 Getting students for class:', classId, 'by user:', sessionUser.role);

    // Check if class exists and user has permission
    const classData = await DatabaseService.getClassById(classId);
    if (!classData) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Class not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check permissions
    if (sessionUser.role === 'teacher' && classData.teacher_id !== sessionUser.id) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'You can only view students in your own classes', 403)),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get students in the class
    const students = await DatabaseService.getUsersByClassId(classId);
    
    console.log(`✅ Found ${students.length} students in class`);

    return new Response(
      JSON.stringify(createApiResponse(students, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error getting class students:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to get class students', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// GET /api/classes/students?access_token=... - Get students by class access token (for student login)
async function handleGetStudentsByAccessToken(request: ApiRequest): Promise<Response> {
  try {
    const accessToken = request.query?.access_token;
    console.log('🔑 Getting students for class access token:', accessToken);

    if (!accessToken) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Access token required', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify the class exists and allows student access
    const classData = await DatabaseService.getClassByAccessToken(accessToken);
    if (!classData || !classData.allow_student_access) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Invalid class access code', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get students in the class
    const students = await DatabaseService.getUsersByClassId(classData.id);
    
    console.log(`✅ Found ${students.length} students for class access`);

    return new Response(
      JSON.stringify(createApiResponse(students, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error getting students by access token:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to get students', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}