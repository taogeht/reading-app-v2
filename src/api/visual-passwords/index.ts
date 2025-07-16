// Visual passwords API routes
// Handles visual password options for student authentication

import { createApiResponse, ApiRequest } from '../index';
import { DatabaseService } from '../../lib/database-service';

export interface VisualPassword {
  id: string;
  name: string;
  display_emoji: string;
  category: 'animals' | 'shapes' | 'colors' | 'objects';
  sort_order: number;
}

// Handle visual password requests
export async function handleVisualPasswordsRequest(request: ApiRequest): Promise<Response> {
  switch (request.method) {
    case 'GET':
      return await handleGetVisualPasswords(request);
    default:
      return new Response(
        JSON.stringify(createApiResponse(null, 'Method not allowed', 405)),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
  }
}

async function handleGetVisualPasswords(request: ApiRequest): Promise<Response> {
  try {
    // Fetch visual passwords from database
    const visualPasswords = await DatabaseService.getVisualPasswords();

    return new Response(
      JSON.stringify(createApiResponse(visualPasswords, null, 200)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get visual passwords error:', error);
    return new Response(
      JSON.stringify(createApiResponse(null, 'Failed to fetch visual passwords', 500)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}