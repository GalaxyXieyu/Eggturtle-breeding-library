import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// API Configuration
// Use empty string for production to make relative API calls
// This allows the frontend to work with any domain through Nginx proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth token management
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('admin_token', token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('admin_token');
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

export const getAuthToken = (): string | null => {
  if (!authToken) {
    authToken = localStorage.getItem('admin_token');
    if (authToken) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    }
  }
  return authToken;
};

// Initialize auth token on startup
getAuthToken();

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Only add timestamp for GET requests in development to prevent caching
    if (config.method === 'get' && import.meta.env.DEV) {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }

    // Only log in development mode
    if (import.meta.env.DEV && import.meta.env.VITE_API_DEBUG === 'true') {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('❌ Response Error:', error);
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      setAuthToken(null);
      // Redirect to admin login if we're in admin area
      if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin') {
        window.location.href = '/admin';
      }
    }
    
    // Handle network errors
    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }
    
    return Promise.reject(error);
  }
);

// API Error types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

// Generic API response wrapper
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

// Helper function to handle API errors
export const handleApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error) && error.response) {
    // Server responded with error status
    const data = error.response.data as unknown;
    const maybeObj = (typeof data === 'object' && data !== null) ? (data as Record<string, unknown>) : undefined;
    const message =
      (typeof maybeObj?.message === 'string' && maybeObj.message) ||
      (typeof maybeObj?.detail === 'string' && maybeObj.detail) ||
      'Server error occurred';
    return {
      message,
      status: error.response.status,
      code: typeof maybeObj?.code === 'string' ? maybeObj.code : undefined,
      details: error.response.data,
    };
  } else if (axios.isAxiosError(error) && error.request) {
    // Request was made but no response received
    return {
      message: 'Network error. Please check your connection.',
      status: 0,
    };
  } else {
    // Something else happened
    return {
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
};

// API Endpoints
export const API_ENDPOINTS = {
  CAROUSELS: '/api/carousels',
  FEATURED_PRODUCTS: '/api/featured-products',
  PRODUCTS: '/api/products',
  AUTH: {
    LOGIN: '/api/auth/login',
    VERIFY: '/api/auth/verify',
  },
} as const;

// Helper function to create full API URLs
export const createApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

// Helper function to create image URLs
export const createImageUrl = (imagePath: string): string => {
  if (!imagePath) return '/placeholder.svg';

  // If it's a base64 data URL, return as is
  if (imagePath.startsWith('data:')) {
    return imagePath;
  }

  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // If backend returned legacy /images/... paths, remap to canonical /static/images/...
  if (imagePath.startsWith('/images/')) {
    const remapped = `/static/images/${imagePath.slice('/images/'.length)}`;
    return API_BASE_URL ? `${API_BASE_URL}${remapped}` : remapped;
  }

  // If it's already a complete path (starts with /), return as is
  if (imagePath.startsWith('/')) {
    return API_BASE_URL ? `${API_BASE_URL}${imagePath}` : imagePath;
  }

  // For relative paths from database (like "images/z08/IMG_0429.JPG")
  // Convert to static file path (/static/images/...)
  const staticPath = imagePath.startsWith('images/') 
    ? `/static/${imagePath}` 
    : `/static/images/${imagePath}`;
  
  return API_BASE_URL ? `${API_BASE_URL}${staticPath}` : staticPath;
};

export default apiClient;
