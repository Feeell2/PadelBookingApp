// ==========================================
// API Service - Axios Client
// ==========================================

import axios from 'axios';
import type { UserPreferences, AgentResponse, ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds for AI agent processing
});

/**
 * Search for flights using AI agent
 */
export async function searchFlights(
  preferences: UserPreferences
): Promise<AgentResponse> {
  try {
    const response = await apiClient.post<ApiResponse<AgentResponse>>(
      '/api/flights/search',
      preferences
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to search flights');
    }

    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.error ||
        error.message ||
        'Network error occurred';
      throw new Error(message);
    }
    throw error;
  }
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await apiClient.get('/api/health');
    return response.data.status === 'ok';
  } catch {
    return false;
  }
}
