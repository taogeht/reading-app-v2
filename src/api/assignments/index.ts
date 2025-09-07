// Assignment API endpoints
// Handles CRUD operations for reading assignments

import { createApiResponse, ApiRequest } from '../index';
import { DatabaseService } from '../../lib/database-service';

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

export interface CreateAssignmentRequest {
  title: string;
  description?: string;
  story_id: string;
  story_title: string;
  class_id: string;
  teacher_id: string;
  due_date?: string;
  instructions?: string;
  max_attempts?: number;
}

export interface UpdateAssignmentRequest {
  title?: string;
  description?: string;
  due_date?: string;
  instructions?: string;
  max_attempts?: number;
  is_published?: boolean;
}

export async function handleAssignmentRequest(request: ApiRequest): Promise<Response> {
  console.log('📝 Assignment request received:', request.method, request.url);
  
  const pathParts = request.url.split('/').filter(Boolean);
  const assignmentId = pathParts[pathParts.length - 1];
  const isAssignmentId = assignmentId && assignmentId !== 'assignments';
  
  switch (request.method) {
    case 'GET':
      if (isAssignmentId) {
        return await handleGetAssignmentById(assignmentId, request);
      } else {
        return await handleGetAssignments(request);
      }
    case 'POST':
      return await handleCreateAssignment(request);
    case 'PUT':
      if (isAssignmentId) {
        return await handleUpdateAssignment(assignmentId, request);
      }
      break;
    case 'DELETE':
      if (isAssignmentId) {
        return await handleDeleteAssignment(assignmentId, request);
      }
      break;
  }
  
  return new Response(
    JSON.stringify(createApiResponse(null, 'Method not allowed', 405)),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleGetAssignments(request: ApiRequest): Promise<Response> {
  try {
    const teacherId = request.query?.teacher_id;
    const classId = request.query?.class_id;
    
    let assignments;
    
    if (teacherId) {
      assignments = await DatabaseService.getAssignmentsByTeacher(teacherId);
    } else if (classId) {
      assignments = await DatabaseService.getAssignmentsByClass(classId);
    } else {
      assignments = await DatabaseService.getAllAssignments();
    }
    
    return new Response(
      JSON.stringify(createApiResponse(assignments, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error getting assignments:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to get assignments', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGetAssignmentById(id: string, request: ApiRequest): Promise<Response> {
  try {
    const assignment = await DatabaseService.getAssignmentById(id);
    
    if (!assignment) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Assignment not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify(createApiResponse(assignment, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error getting assignment by ID:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to get assignment', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleCreateAssignment(request: ApiRequest): Promise<Response> {
  try {
    const body: CreateAssignmentRequest = request.body;
    
    // Validate required fields
    if (!body.title || !body.story_id || !body.story_title || !body.class_id || !body.teacher_id) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Missing required fields', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const assignment = await DatabaseService.createAssignment({
      title: body.title,
      description: body.description || null,
      story_id: body.story_id,
      story_title: body.story_title,
      class_id: body.class_id,
      teacher_id: body.teacher_id,
      due_date: body.due_date || null,
      instructions: body.instructions || null,
      max_attempts: body.max_attempts || 3,
      is_published: false, // Start as draft
    });
    
    if (!assignment) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to create assignment', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify(createApiResponse(assignment, null, 201, 'Assignment created successfully')),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error creating assignment:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to create assignment', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleUpdateAssignment(id: string, request: ApiRequest): Promise<Response> {
  try {
    const body: UpdateAssignmentRequest = request.body;
    
    const assignment = await DatabaseService.updateAssignment(id, body);
    
    if (!assignment) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Assignment not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify(createApiResponse(assignment, null, 200, 'Assignment updated successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error updating assignment:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to update assignment', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleDeleteAssignment(id: string, request: ApiRequest): Promise<Response> {
  try {
    const success = await DatabaseService.deleteAssignment(id);
    
    if (!success) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Assignment not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify(createApiResponse(null, null, 200, 'Assignment deleted successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error deleting assignment:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to delete assignment', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}