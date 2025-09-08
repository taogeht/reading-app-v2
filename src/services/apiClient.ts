// Unified API client for all data operations
// Replaces direct database access with secure API calls

import type { SignUpRequest, SignInRequest, UserSession } from '../api/auth/index';
import type { VisualPassword } from '../api/visual-passwords/index';
import type { ClassInfo, CreateClassRequest, UpdateClassRequest } from '../api/classes/index';
import type { Recording } from '../api/recordings/index';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// API client class
export class ApiClient {
  private baseURL: string;
  private authToken: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
    // Try to get stored auth token
    this.authToken = localStorage.getItem('auth_token');
  }

  // Set authentication token
  setAuthToken(token: string) {
    this.authToken = token;
    localStorage.setItem('auth_token', token);
  }

  // Clear authentication token
  clearAuthToken() {
    this.authToken = null;
    localStorage.removeItem('auth_token');
  }

  // Generic API request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string; status: number }> {
    const url = `${this.baseURL}/api${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add auth header if token is available
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch {
        responseData = { error: 'Invalid response format' };
      }

      return {
        data: responseData.data,
        error: responseData.error,
        status: response.status,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
      };
    }
  }

  // Authentication methods
  async signUp(userData: SignUpRequest): Promise<{ user?: UserSession; error?: string }> {
    const response = await this.request<UserSession>('/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.data && response.status === 201) {
      return { user: response.data };
    }

    return { error: response.error || 'Sign up failed' };
  }

  async signIn(credentials: SignInRequest): Promise<{ user?: UserSession; token?: string; error?: string }> {
    const response = await this.request<UserSession>('/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.data && response.status === 200) {
      // In a real implementation, the API would return a token
      const mockToken = `auth_token_${Date.now()}`;
      this.setAuthToken(mockToken);
      
      return { 
        user: response.data, 
        token: mockToken 
      };
    }

    return { error: response.error || 'Sign in failed' };
  }

  async signOut(): Promise<{ error?: string }> {
    const response = await this.request('/auth/sign-out', {
      method: 'POST',
    });

    // Clear token regardless of API response
    this.clearAuthToken();

    if (response.status === 200) {
      return {};
    }

    return { error: response.error || 'Sign out failed' };
  }

  async getSession(): Promise<{ user?: UserSession; error?: string }> {
    if (!this.authToken) {
      return { error: 'No authentication token' };
    }

    const response = await this.request<UserSession>('/auth/session');

    if (response.data && response.status === 200) {
      return { user: response.data };
    }

    // If session is invalid, clear token
    if (response.status === 401) {
      this.clearAuthToken();
    }

    return { error: response.error || 'Session invalid' };
  }

  async forgotPassword(email: string): Promise<{ error?: string }> {
    const response = await this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (response.status === 200) {
      return {};
    }

    return { error: response.error || 'Password reset failed' };
  }

  // Visual passwords methods
  async getVisualPasswords(): Promise<{ passwords?: VisualPassword[]; error?: string }> {
    const response = await this.request<VisualPassword[]>('/visual-passwords');

    if (response.data && response.status === 200) {
      return { passwords: response.data };
    }

    return { error: response.error || 'Failed to fetch visual passwords' };
  }

  // User management methods (to be implemented)
  async getUsers(): Promise<{ users?: UserSession[]; error?: string }> {
    const response = await this.request<UserSession[]>('/users');
    
    if (response.data && response.status === 200) {
      return { users: response.data };
    }
    
    return { error: response.error || 'Failed to fetch users' };
  }

  async getUser(id: string): Promise<{ user?: UserSession; error?: string }> {
    const response = await this.request<UserSession>(`/users/${id}`);
    
    if (response.data && response.status === 200) {
      return { user: response.data };
    }
    
    return { error: response.error || 'Failed to fetch user' };
  }

  async updateUser(id: string, updates: Partial<UserSession>): Promise<{ user?: UserSession; error?: string }> {
    const response = await this.request<UserSession>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    if (response.data && response.status === 200) {
      return { user: response.data };
    }
    
    return { error: response.error || 'Failed to update user' };
  }

  // Classes management methods
  async getClasses(teacherId?: string): Promise<{ classes?: ClassInfo[]; error?: string }> {
    const queryParam = teacherId ? `?teacher_id=${teacherId}` : '';
    const response = await this.request<ClassInfo[]>(`/classes${queryParam}`);
    
    if (response.data && response.status === 200) {
      return { classes: response.data };
    }
    
    return { error: response.error || 'Failed to fetch classes' };
  }

  async getClass(id: string): Promise<{ class?: ClassInfo; error?: string }> {
    const response = await this.request<ClassInfo>(`/classes/${id}`);
    
    if (response.data && response.status === 200) {
      return { class: response.data };
    }
    
    return { error: response.error || 'Failed to fetch class' };
  }

  async createClass(classData: CreateClassRequest): Promise<{ class?: ClassInfo; error?: string }> {
    const response = await this.request<ClassInfo>('/classes', {
      method: 'POST',
      body: JSON.stringify(classData),
    });
    
    if (response.data && response.status === 201) {
      return { class: response.data };
    }
    
    return { error: response.error || 'Failed to create class' };
  }

  async updateClass(id: string, updates: UpdateClassRequest): Promise<{ class?: ClassInfo; error?: string }> {
    const response = await this.request<ClassInfo>(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    if (response.data && response.status === 200) {
      return { class: response.data };
    }
    
    return { error: response.error || 'Failed to update class' };
  }

  async deleteClass(id: string): Promise<{ error?: string }> {
    const response = await this.request(`/classes/${id}`, {
      method: 'DELETE',
    });
    
    if (response.status === 200) {
      return {};
    }
    
    return { error: response.error || 'Failed to delete class' };
  }

  // Recordings management methods
  async getRecordings(assignmentId?: string, studentId?: string): Promise<{ recordings?: Recording[]; error?: string }> {
    let queryParams = '';
    if (assignmentId) {
      queryParams = `?assignment_id=${assignmentId}`;
    } else if (studentId) {
      queryParams = `?student_id=${studentId}`;
    }
    
    const response = await this.request<Recording[]>(`/recordings${queryParams}`);
    
    if (response.data && response.status === 200) {
      return { recordings: response.data };
    }
    
    return { error: response.error || 'Failed to fetch recordings' };
  }

  async getRecordingsByClass(classId: string): Promise<{ recordings?: Recording[]; error?: string }> {
    // First get assignments for this class, then get recordings for those assignments
    try {
      const { classes: teacherClasses } = await this.getClasses();
      const assignments = []; // We'd need to implement getAssignmentsByClass
      
      // For now, return all recordings (in a real implementation, we'd filter by class)
      const response = await this.request<Recording[]>('/recordings');
      
      if (response.data && response.status === 200) {
        return { recordings: response.data };
      }
      
      return { error: response.error || 'Failed to fetch recordings' };
    } catch (error) {
      return { error: 'Failed to fetch recordings for class' };
    }
  }

  async getRecording(id: string): Promise<{ recording?: Recording; error?: string }> {
    const response = await this.request<Recording>(`/recordings/${id}`);
    
    if (response.data && response.status === 200) {
      return { recording: response.data };
    }
    
    return { error: response.error || 'Failed to fetch recording' };
  }

  async createRecording(recordingData: any): Promise<{ recording?: Recording; error?: string }> {
    const response = await this.request<Recording>('/recordings', {
      method: 'POST',
      body: JSON.stringify(recordingData),
    });
    
    if (response.data && response.status === 201) {
      return { recording: response.data };
    }
    
    return { error: response.error || 'Failed to create recording' };
  }

  async updateRecording(id: string, updates: any): Promise<{ recording?: Recording; error?: string }> {
    const response = await this.request<Recording>(`/recordings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    if (response.data && response.status === 200) {
      return { recording: response.data };
    }
    
    return { error: response.error || 'Failed to update recording' };
  }

  async archiveRecording(id: string): Promise<{ error?: string }> {
    const response = await this.request(`/recordings/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'archive' }),
    });
    
    if (response.status === 200) {
      return {};
    }
    
    return { error: response.error || 'Failed to archive recording' };
  }

  async unarchiveRecording(id: string): Promise<{ error?: string }> {
    const response = await this.request(`/recordings/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'unarchive' }),
    });
    
    if (response.status === 200) {
      return {};
    }
    
    return { error: response.error || 'Failed to unarchive recording' };
  }

  async deleteRecording(id: string): Promise<{ error?: string }> {
    const response = await this.request(`/recordings/${id}`, {
      method: 'DELETE',
    });
    
    if (response.status === 200) {
      return {};
    }
    
    return { error: response.error || 'Failed to delete recording' };
  }

  async getRecordingUrl(id: string): Promise<{ url?: string; error?: string }> {
    const response = await this.request<{ url: string }>(`/recordings/${id}/url`);
    
    if (response.data && response.status === 200) {
      return { url: response.data.url };
    }
    
    return { error: response.error || 'Failed to get recording URL' };
  }
}

// Create singleton API client instance
export const apiClient = new ApiClient();

// Export types for use in components
export type { SignUpRequest, SignInRequest, UserSession, VisualPassword, ClassInfo, CreateClassRequest, UpdateClassRequest, Recording };