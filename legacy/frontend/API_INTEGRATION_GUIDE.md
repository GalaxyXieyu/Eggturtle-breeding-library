# Frontend API Integration Guide

## Overview

This document outlines the complete API integration setup for the Glam Cart Builder frontend application. The integration includes both public APIs (no authentication) and protected admin APIs (authentication required).

## 🚀 Implementation Summary

### ✅ Completed Features

1. **API Client Configuration** (`src/lib/api.ts`)
   - Axios-based HTTP client with interceptors
   - Automatic token management
   - Request/response logging
   - Error handling with automatic token refresh
   - Image URL helper functions

2. **Service Layer** 
   - **Product Service** (`src/services/productService.ts`)
     - Public product APIs (listing, details, featured products)
     - Admin product APIs (CRUD operations, image upload)
   - **Authentication Service** (`src/services/authService.ts`)
     - Login/logout functionality
     - Token verification and refresh
     - User session management

3. **React Query Hooks**
   - **Product Hooks** (`src/hooks/useProducts.ts`)
     - `useProducts()` - Fetch products with filtering/sorting
     - `useProduct()` - Fetch single product by ID
     - `useFeaturedProducts()` - Fetch featured products
     - `useCreateProduct()` - Create new product (admin)
     - `useUpdateProduct()` - Update existing product (admin)
     - `useDeleteProduct()` - Delete product (admin)
     - `useUploadProductImages()` - Upload product images (admin)
   - **Authentication Hooks** (`src/hooks/useAuth.ts`)
     - `useAuth()` - Main authentication hook
     - `useRequireAuth()` - Protect admin routes
     - `useRedirectIfAuthenticated()` - Redirect authenticated users

4. **Updated Components**
   - **Index Page** - Now uses API data with fallback to mock data
   - **ProductDetail Page** - Integrated with product API
   - **AdminProducts Page** - Full CRUD operations with API
   - **AdminLogin Page** - Real authentication integration

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the frontend directory:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8000

# Development settings
VITE_NODE_ENV=development

# Optional: Enable API request logging
VITE_API_DEBUG=true
```

### Dependencies Added

- `axios` - HTTP client for API requests

## 📡 API Endpoints Expected

### Public APIs (No Authentication)

```
GET /api/products                    # Get all products with filtering
GET /api/products/{id}              # Get single product
GET /api/products/featured          # Get featured products
GET /api/products/filter-options    # Get filter options
```

### Admin APIs (Authentication Required)

```
POST /api/auth/login                # Admin login
POST /api/auth/logout               # Admin logout
GET  /api/auth/verify               # Verify token
POST /api/auth/refresh              # Refresh token

POST /api/products                  # Create product
PUT  /api/products/{id}             # Update product
DELETE /api/products/{id}           # Delete product
POST /api/products/{id}/images      # Upload product images
DELETE /api/products/{id}/images/{imageId} # Delete product image
```

## 🔐 Authentication Flow

1. **Login Process**:
   - User submits credentials via AdminLogin page
   - API returns JWT token and user info
   - Token stored in localStorage and axios headers
   - User redirected to admin dashboard

2. **Protected Routes**:
   - Admin pages use `useRequireAuth()` hook
   - Automatically redirects to login if not authenticated
   - Token verified on page load

3. **Token Management**:
   - Automatic token refresh on API calls
   - Token cleared on logout or auth errors
   - Persistent login across browser sessions

## 📊 Data Flow

### Public Interface
```
Component → useProducts() → productService → API → Display Data
                ↓
         Fallback to mockProducts if API fails
```

### Admin Interface
```
Admin Component → useAuth() → Check Authentication
                     ↓
              useCreateProduct() → adminProductService → API
              useUpdateProduct() → adminProductService → API
              useDeleteProduct() → adminProductService → API
```

## 🎯 Key Features

### 1. **Graceful Degradation**
- API calls with automatic fallback to mock data
- Error handling with user-friendly messages
- Loading states for better UX

### 2. **Image Handling**
- Automatic image URL processing
- Support for relative and absolute paths
- Image upload with preview functionality

### 3. **Real-time Updates**
- React Query cache invalidation
- Optimistic updates for better UX
- Automatic refetching on focus

### 4. **Error Handling**
- Network error detection
- Authentication error handling
- User-friendly error messages
- Retry mechanisms

## 🔄 Usage Examples

### Fetching Products (Public)
```typescript
const { data, isLoading, error } = useProducts({
  sort: 'newest',
  page: 1,
  limit: 12
});
```

### Creating Product (Admin)
```typescript
const createProduct = useCreateProduct();

const handleCreate = (productData) => {
  createProduct.mutate(productData, {
    onSuccess: () => {
      // Handle success
    }
  });
};
```

### Authentication
```typescript
const { login, isAuthenticated, user } = useAuth();

const handleLogin = async (credentials) => {
  try {
    await login(credentials);
    // Automatically redirected on success
  } catch (error) {
    // Error handled by hook
  }
};
```

## 🚧 Backend Requirements

To complete the integration, the backend needs to implement:

1. **Product API endpoints** with the expected request/response format
2. **Authentication system** with JWT tokens
3. **Image upload handling** with file storage
4. **CORS configuration** for frontend domain
5. **Error response standardization**

## 🔍 Testing

The implementation includes:
- Automatic fallback to mock data for development
- Error boundary handling
- Loading state management
- Authentication flow testing

## 📝 Next Steps

1. **Backend Implementation**: Create the Python API endpoints
2. **Image Storage**: Set up file upload and storage system
3. **Database Integration**: Connect to product database
4. **Production Deployment**: Configure environment variables
5. **Testing**: Add comprehensive API integration tests

## 🛠️ Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure backend CORS is configured for frontend domain
2. **Authentication Failures**: Check token format and expiration
3. **Image Upload Issues**: Verify file size limits and formats
4. **Network Errors**: Check API base URL configuration

### Debug Mode

Enable debug logging by setting `VITE_API_DEBUG=true` in your `.env` file.
