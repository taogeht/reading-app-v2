// Visual passwords API routes
// Handles visual password options for student authentication

import { createApiResponse, ApiRequest } from '../index';

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
    // TODO: Fetch from database
    console.warn('Get visual passwords not fully implemented - using mock data');

    const mockVisualPasswords: VisualPassword[] = [
      { id: '1', name: 'Cat', display_emoji: '🐱', category: 'animals', sort_order: 1 },
      { id: '2', name: 'Dog', display_emoji: '🐶', category: 'animals', sort_order: 2 },
      { id: '3', name: 'Lion', display_emoji: '🦁', category: 'animals', sort_order: 3 },
      { id: '4', name: 'Elephant', display_emoji: '🐘', category: 'animals', sort_order: 4 },
      { id: '5', name: 'Star', display_emoji: '⭐', category: 'shapes', sort_order: 5 },
      { id: '6', name: 'Heart', display_emoji: '❤️', category: 'shapes', sort_order: 6 },
      { id: '7', name: 'Circle', display_emoji: '⭕', category: 'shapes', sort_order: 7 },
      { id: '8', name: 'Square', display_emoji: '◻️', category: 'shapes', sort_order: 8 },
      { id: '9', name: 'Apple', display_emoji: '🍎', category: 'objects', sort_order: 9 },
      { id: '10', name: 'Ball', display_emoji: '⚽', category: 'objects', sort_order: 10 },
      { id: '11', name: 'Book', display_emoji: '📚', category: 'objects', sort_order: 11 },
      { id: '12', name: 'Car', display_emoji: '🚗', category: 'objects', sort_order: 12 },
    ];

    // Sort by category and then by sort_order
    const sortedPasswords = mockVisualPasswords.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.sort_order - b.sort_order;
    });

    return new Response(
      JSON.stringify(createApiResponse(sortedPasswords, null, 200)),
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