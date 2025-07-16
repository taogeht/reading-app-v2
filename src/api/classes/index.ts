// Classes API routes
// Handles class management for teachers and admins

import { createApiResponse, ApiRequest } from '../index';
import { DatabaseService } from '../../lib/database-service';

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
export async function handleClassesRequest(request: ApiRequest): Promise<Response> {
  const pathParts = request.url.split('/').filter(Boolean);
  const classId = pathParts[pathParts.length - 1];

  switch (request.method) {
    case 'GET':
      if (classId && classId !== 'classes') {
        return await handleGetClass(request, classId);
      } else {
        return await handleGetClasses(request);
      }
    case 'POST':
      return await handleCreateClass(request);
    case 'PUT':
      return await handleUpdateClass(request, classId);
    case 'DELETE':
      return await handleDeleteClass(request, classId);
    default:
      return new Response(
        JSON.stringify(createApiResponse(null, 'Method not allowed', 405)),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
  }
}

async function handleGetClasses(request: ApiRequest): Promise<Response> {
  try {
    // Get teacher ID from query params
    const teacherId = request.query?.teacher_id;

    let classes;
    if (teacherId) {
      // Get classes for specific teacher
      classes = await DatabaseService.getClassesByTeacher(teacherId);
    } else {
      // Get all classes (admin access)
      classes = await DatabaseService.getAllClasses();
    }

    return new Response(
      JSON.stringify(createApiResponse(classes, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get classes error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to fetch classes', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGetClass(request: ApiRequest, classId: string): Promise<Response> {
  try {
    const classInfo = await DatabaseService.getClassById(classId);

    if (!classInfo) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Class not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(createApiResponse(classInfo, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get class error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to fetch class', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleCreateClass(request: ApiRequest): Promise<Response> {
  try {
    const body: CreateClassRequest = request.body;

    // Validate required fields
    if (!body.name || !body.grade_level) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Missing required fields: name, grade_level', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get teacher ID from request body - will be provided by the frontend
    const teacherId = body.teacher_id;
    if (!teacherId) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Teacher ID required', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const newClass = await DatabaseService.createClass({
      name: body.name,
      grade_level: body.grade_level,
      teacher_id: teacherId,
      school_year: body.school_year,
      description: body.description,
      allow_student_access: body.allow_student_access !== false, // default true
    });

    if (!newClass) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to create class', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(createApiResponse(newClass, null, 201, 'Class created successfully')),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create class error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to create class', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleUpdateClass(request: ApiRequest, classId: string): Promise<Response> {
  try {
    const body: UpdateClassRequest = request.body;

    const updatedClass = await DatabaseService.updateClass(classId, body);

    if (!updatedClass) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Class not found or update failed', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(createApiResponse(updatedClass, null, 200, 'Class updated successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update class error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to update class', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleDeleteClass(request: ApiRequest, classId: string): Promise<Response> {
  try {
    const success = await DatabaseService.deleteClass(classId);

    if (!success) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Class not found or delete failed', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(createApiResponse(null, null, 200, 'Class deleted successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete class error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to delete class', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}