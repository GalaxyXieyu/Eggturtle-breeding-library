import apiClient, { ApiResponse, handleApiError, createImageUrl } from '@/lib/api';
import { Product, FilterOptions, FilterOptionsResponse, SortOption } from '@/types/products';

// Backend API data structure (snake_case)
interface BackendProductCreate {
  name: string;
  code: string;
  description?: string;
  stage?: string;
  status?: 'draft' | 'active' | 'reserved' | 'sold';
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
  }): Promise<{
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const queryParams: Record<string, unknown> = { ...params };
      if (params?.filters) {
        delete queryParams.filters;
      }

      const response = await apiClient.get<ApiResponse<{
        products: Product[];
        total: number;
        page: number;
        totalPages: number;
      }>>(ENDPOINTS.PRODUCTS, { params: queryParams });

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
