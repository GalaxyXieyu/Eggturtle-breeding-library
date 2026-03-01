import apiClient, { ApiResponse, handleApiError, setAuthToken } from '@/lib/api';

// Auth API endpoints
const ENDPOINTS = {
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  VERIFY_TOKEN: '/api/auth/verify',
  REFRESH_TOKEN: '/api/auth/refresh',
};

// Auth types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
  expiresAt: string;
}

export interface User {
  id: string;
  username: string;
  role: string;
}

// Authentication service
export const authService = {
  // Admin login
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>(
        ENDPOINTS.LOGIN,
        credentials
      );

      const authData = response.data.data;
      
      // Set the auth token in the API client
      setAuthToken(authData.token);
      
      return authData;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Admin logout
  async logout(): Promise<void> {
    try {
      await apiClient.post(ENDPOINTS.LOGOUT);
    } catch (error) {
      // Even if logout fails on server, clear local token
      console.warn('Logout request failed, but clearing local token');
    } finally {
      // Always clear the local token
      setAuthToken(null);
    }
  },

  // Verify current token
  async verifyToken(): Promise<User> {
    try {
      const response = await apiClient.get<ApiResponse<User>>(ENDPOINTS.VERIFY_TOKEN);
      return response.data.data;
    } catch (error) {
      // If token verification fails, clear it
      setAuthToken(null);
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Refresh token
  async refreshToken(): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>(ENDPOINTS.REFRESH_TOKEN);
      
      const authData = response.data.data;
      
      // Update the auth token
      setAuthToken(authData.token);
      
      return authData;
    } catch (error) {
      // If refresh fails, clear the token
      setAuthToken(null);
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = localStorage.getItem('admin_token');
    return !!token;
  },

  // Get current user from token (basic implementation)
  getCurrentUser(): User | null {
    const token = localStorage.getItem('admin_token');
    if (!token) return null;

    try {
      // In a real implementation, you might decode the JWT token
      // For now, we'll return a basic user object
      return {
        id: 'admin',
        username: 'admin',
        role: 'admin',
      };
    } catch (error) {
      console.error('Error parsing user from token:', error);
      return null;
    }
  },
};

// Auth context hook data
export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  verifyToken: () => Promise<void>;
}

// Auth error types
export class AuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Helper function to handle auth errors
export const handleAuthError = (error: unknown): AuthError => {
  const apiError = handleApiError(error);
  
  if (apiError.status === 401) {
    return new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
  } else if (apiError.status === 403) {
    return new AuthError('Access denied', 'ACCESS_DENIED');
  } else if (apiError.status === 429) {
    return new AuthError('Too many login attempts. Please try again later.', 'RATE_LIMITED');
  } else {
    return new AuthError(apiError.message, apiError.code);
  }
};
