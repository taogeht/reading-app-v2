// Recordings API routes
// Handles student recording submissions and teacher feedback

import { createApiResponse, ApiRequest } from '../index';
import { DatabaseService } from '../../lib/database-service';

export interface Recording {
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
  is_archived?: boolean;
  file_path?: string;
}

// Handle recordings requests
export async function handleRecordingsRequest(request: ApiRequest): Promise<Response> {
  const pathParts = request.url.split('/').filter(Boolean);
  const recordingId = pathParts[pathParts.length - 1];

  switch (request.method) {
    case 'GET':
      if (recordingId && recordingId !== 'recordings') {
        return await handleGetRecording(request, recordingId);
      } else {
        return await handleGetRecordings(request);
      }
    case 'POST':
      return await handleCreateRecording(request);
    case 'PUT':
      return await handleUpdateRecording(request, recordingId);
    case 'DELETE':
      return await handleDeleteRecording(request, recordingId);
    default:
      return new Response(
        JSON.stringify(createApiResponse(null, 'Method not allowed', 405)),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
  }
}

async function handleGetRecordings(request: ApiRequest): Promise<Response> {
  try {
    // Get recordings by class ID
    const classId = request.query?.class_id;
    
    if (!classId) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'class_id parameter required', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const recordings = await DatabaseService.getRecordingsByClass(classId);

    return new Response(
      JSON.stringify(createApiResponse(recordings, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get recordings error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to fetch recordings', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGetRecording(request: ApiRequest, recordingId: string): Promise<Response> {
  try {
    // Handle special recording URL endpoint
    if (request.url.includes('/url')) {
      const recording = await DatabaseService.getRecordingById(recordingId.replace('/url', ''));
      
      if (!recording) {
        return new Response(
          JSON.stringify(createApiResponse(null, 'Recording not found', 404)),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // For now, return the file path as URL (in production, this would be a signed URL)
      const url = recording.file_path || recording.audio_url;
      return new Response(
        JSON.stringify(createApiResponse({ url }, null, 200)),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const recording = await DatabaseService.getRecordingById(recordingId);

    if (!recording) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Recording not found', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(createApiResponse(recording, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get recording error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to fetch recording', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleCreateRecording(request: ApiRequest): Promise<Response> {
  try {
    const body = request.body;

    // Validate required fields
    if (!body.student_id || !body.assignment_id || !body.audio_url) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Missing required fields', 400)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const newRecording = await DatabaseService.createRecording(body);

    if (!newRecording) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Failed to create recording', 500)),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(createApiResponse(newRecording, null, 201, 'Recording created successfully')),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create recording error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to create recording', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleUpdateRecording(request: ApiRequest, recordingId: string): Promise<Response> {
  try {
    const body = request.body;

    // Handle archive/unarchive operations
    if (body.action === 'archive') {
      const success = await DatabaseService.archiveRecording(recordingId);
      if (success) {
        return new Response(
          JSON.stringify(createApiResponse(null, null, 200, 'Recording archived successfully')),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (body.action === 'unarchive') {
      const success = await DatabaseService.unarchiveRecording(recordingId);
      if (success) {
        return new Response(
          JSON.stringify(createApiResponse(null, null, 200, 'Recording unarchived successfully')),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Regular update
      const updatedRecording = await DatabaseService.updateRecording(recordingId, body);
      if (updatedRecording) {
        return new Response(
          JSON.stringify(createApiResponse(updatedRecording, null, 200, 'Recording updated successfully')),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify(createApiResponse(null, 'Recording not found or update failed', 404)),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update recording error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to update recording', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleDeleteRecording(request: ApiRequest, recordingId: string): Promise<Response> {
  try {
    const success = await DatabaseService.deleteRecording(recordingId);

    if (!success) {
      return new Response(
        JSON.stringify(createApiResponse(null, 'Recording not found or delete failed', 404)),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(createApiResponse(null, null, 200, 'Recording deleted successfully')),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete recording error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to delete recording', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}