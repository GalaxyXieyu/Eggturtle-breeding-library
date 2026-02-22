import axios from 'axios';

import apiClient, { ApiResponse, handleApiError, createImageUrl } from '@/lib/api';
import { Product, FilterOptions, FilterOptionsResponse, SortOption } from '@/types/products';

// Backend API data structure (snake_case)
interface BackendProductCreate {
  code: string;
  description?: string;
  series_id?: string | null;
  cost_price: number;
  price: number;
  has_sample: boolean;
  in_stock: boolean;
  popularity_score: number;
  images: Array<{
    url: string;
    alt: string;
    type: 'main' | 'gallery' | 'dimensions' | 'detail';
  }>;
}

// Product API endpoints
const ENDPOINTS = {
  PRODUCTS: '/api/products',
  PRODUCT_BY_ID: (id: string) => `/api/products/${id}`,
  PRODUCT_IMAGES: (id: string) => `/api/products/${id}/images`,
};

// Public Product APIs (No Authentication Required)
export const productService = {
  // Get all products with optional filtering and sorting
  async getProducts(params?: {
    filters?: FilterOptions;
    sort?: SortOption;
    page?: number;
    limit?: number;
    search?: string;
    signal?: AbortSignal;
  }): Promise<{
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      // Build query params explicitly so we don't accidentally send unsupported keys (e.g. `enabled`).
      const queryParams: Record<string, unknown> = {};

      if (typeof params?.page === 'number') queryParams.page = params.page;
      if (typeof params?.limit === 'number') queryParams.limit = params.limit;
      if (typeof params?.search === 'string' && params.search.trim()) queryParams.search = params.search.trim();
      if (params?.sort) queryParams.sort = params.sort;

      // Flatten filters into query params. Backend expects snake_case.
      if (params?.filters) {
        const filters = params.filters as Record<string, unknown>;

        // Common frontend filter keys
        if (!queryParams.search && typeof filters.searchText === 'string' && filters.searchText.trim()) {
          queryParams.search = filters.searchText.trim();
        }

        // Admin (snake_case) filters
        if (typeof filters.sex === 'string' && filters.sex) queryParams.sex = filters.sex;
        if (typeof filters.series_id === 'string' && filters.series_id) queryParams.series_id = filters.series_id;
        if (typeof filters.price_min === 'number') queryParams.price_min = filters.price_min;
        if (typeof filters.price_max === 'number') queryParams.price_max = filters.price_max;

        // Public (camelCase) filters -> backend snake_case
        if (!queryParams.series_id && typeof filters.seriesId === 'string' && filters.seriesId) {
          queryParams.series_id = filters.seriesId;
        }
        if (filters.priceRange && typeof filters.priceRange === 'object') {
          const pr = filters.priceRange as { min?: unknown; max?: unknown };
          if (typeof pr.min === 'number') queryParams.price_min = pr.min;
          if (typeof pr.max === 'number') queryParams.price_max = pr.max;
        }
      }

      const response = await apiClient.get<ApiResponse<{
        products: Product[];
        total: number;
        page: number;
        totalPages: number;
      }>>(ENDPOINTS.PRODUCTS, { params: queryParams, signal: params?.signal });

      // Process image URLs with safety check
      const rawProducts = response.data.data?.products || [];
      const processedProducts = rawProducts.map(product => ({
        ...product,
        images: (product.images || []).map(img => ({
          ...img,
          url: createImageUrl(img.url),
        })),
      }));

      return {
        ...response.data.data,
        products: processedProducts,
      };
    } catch (error) {
      // Let TanStack Query treat request aborts as cancellations (no error state/toast).
      if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
        throw error;
      }

      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Get single product by ID
  async getProductById(id: string): Promise<Product> {
    try {
      const response = await apiClient.get<ApiResponse<Product>>(
        ENDPOINTS.PRODUCT_BY_ID(id)
      );

      // Process image URLs
      const product = {
        ...response.data.data,
        images: response.data.data.images.map(img => ({
          ...img,
          url: createImageUrl(img.url),
        })),
      };

      return product;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Get featured products
  async getFeaturedProducts(limit: number = 8): Promise<Product[]> {
    try {
      const response = await apiClient.get<ApiResponse<Product[]>>(
        `${ENDPOINTS.PRODUCTS}/featured`,
        { params: { limit } }
      );

      // Process image URLs with safety check
      const rawProducts = response.data.data || [];
      const products = rawProducts.map(product => ({
        ...product,
        images: (product.images || []).map(img => ({
          ...img,
          url: createImageUrl(img.url),
        })),
      }));

      return products;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Get filter options (for dynamic filter generation)
  async getFilterOptions(): Promise<FilterOptionsResponse> {
    try {
      const response = await apiClient.get<ApiResponse<FilterOptionsResponse>>(`${ENDPOINTS.PRODUCTS}/filter-options`);

      return response.data.data;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },
};

// Admin Product APIs (Authentication Required)
export const adminProductService = {
  // Create new product
  async createProduct(productData: BackendProductCreate): Promise<Product> {
    try {
      const response = await apiClient.post<ApiResponse<Product>>(
        ENDPOINTS.PRODUCTS,
        productData
      );

      // Process image URLs
      const product = {
        ...response.data.data,
        images: response.data.data.images.map(img => ({
          ...img,
          url: createImageUrl(img.url),
        })),
      };

      return product;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Update existing product
  async updateProduct(id: string, productData: Record<string, unknown>): Promise<Product> {
    try {
      const response = await apiClient.put<ApiResponse<Product>>(
        ENDPOINTS.PRODUCT_BY_ID(id),
        productData
      );

      // Process image URLs
      const product = {
        ...response.data.data,
        images: response.data.data.images.map(img => ({
          ...img,
          url: createImageUrl(img.url),
        })),
      };

      return product;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Delete product
  async deleteProduct(id: string): Promise<void> {
    try {
      await apiClient.delete(ENDPOINTS.PRODUCT_BY_ID(id));
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Upload product images
  async uploadProductImages(productId: string, files: File[]): Promise<{
    images: Array<{
      id: string;
      url: string;
      alt: string;
      type: 'main' | 'gallery' | 'dimensions' | 'detail';
    }>;
  }> {
    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`images`, file);
      });

      const response = await apiClient.post<ApiResponse<{
        images: Array<{
          id: string;
          url: string;
          alt: string;
          type: 'main' | 'gallery' | 'dimensions' | 'detail';
        }>;
      }>>(
        ENDPOINTS.PRODUCT_IMAGES(productId),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Process image URLs
      const processedImages = response.data.data.images.map(img => ({
        ...img,
        url: createImageUrl(img.url),
      }));

      return {
        images: processedImages,
      };
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Delete product image
  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    try {
      await apiClient.delete(`${ENDPOINTS.PRODUCT_IMAGES(productId)}/${imageId}`);
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Set one image as main
  async setMainProductImage(productId: string, imageId: string): Promise<{
    images: Array<{
      id: string;
      url: string;
      alt: string;
      type: 'main' | 'gallery' | 'dimensions' | 'detail';
    }>;
  }> {
    try {
      const response = await apiClient.put<ApiResponse<{
        images: Array<{
          id: string;
          url: string;
          alt: string;
          type: 'main' | 'gallery' | 'dimensions' | 'detail';
        }>;
      }>>(`${ENDPOINTS.PRODUCT_IMAGES(productId)}/${imageId}/set-main`);

      const processedImages = response.data.data.images.map(img => ({
        ...img,
        url: createImageUrl(img.url),
      }));

      return { images: processedImages };
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Reorder product images
  async reorderProductImages(productId: string, imageOrders: Array<{id: string, sort_order: number}>): Promise<{
    images: Array<{
      id: string;
      url: string;
      alt: string;
      type: 'main' | 'gallery' | 'dimensions' | 'detail';
      sort_order: number;
    }>;
  }> {
    try {
      const response = await apiClient.put<ApiResponse<Array<{
        id: string;
        url: string;
        alt: string;
        type: 'main' | 'gallery' | 'dimensions' | 'detail';
        sort_order: number;
      }>>>(
        `${ENDPOINTS.PRODUCT_IMAGES(productId)}/reorder`,
        imageOrders
      );

      // Process image URLs
      const processedImages = response.data.data.map(img => ({
        ...img,
        url: createImageUrl(img.url),
      }));

      return {
        images: processedImages,
      };
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Batch Import
  async batchImportProducts(excelFile: File, zipFile?: File): Promise<{
    success: boolean;
    total: number;
    imported: number;
    failed: number;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const formData = new FormData();
      formData.append('excel_file', excelFile);
      if (zipFile) {
        formData.append('zip_file', zipFile);
      }

      const response = await apiClient.post<ApiResponse<{
        success: boolean;
        total: number;
        imported: number;
        failed: number;
        errors: string[];
        warnings: string[];
      }>>(
        '/api/products/batch-import',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data.data;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },

  // Download Template
  async getImportTemplate(): Promise<Blob> {
    try {
      const response = await apiClient.get(
        '/api/products/batch-import/template',
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message);
    }
  },
};
