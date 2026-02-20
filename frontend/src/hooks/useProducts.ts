import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService, adminProductService } from '@/services/productService';
import { Product, FilterOptions, SortOption } from '@/types/products';
import { useToast } from '@/hooks/use-toast';

// Backend API data structure (snake_case) - matching the one in productService
interface BackendProductCreate {
  name: string;
  code: string;
  description?: string;
  stage?: string;
  status?: 'draft' | 'active' | 'reserved' | 'sold';
  dimensions: {
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
    capacity?: {
      min: number;
      max: number;
    };
    compartments?: number;
  };
  cost_price: number;
  price: number;
  has_sample: boolean;
  box_dimensions?: string;
  box_quantity?: number;
  in_stock: boolean;
  popularity_score: number;
  images: Array<{
    url: string;
    alt: string;
    type: 'main' | 'gallery' | 'dimensions' | 'detail';
  }>;
}

// Query keys
export const PRODUCT_QUERY_KEYS = {
  all: ['products'] as const,
  lists: () => [...PRODUCT_QUERY_KEYS.all, 'list'] as const,
  list: (filters?: FilterOptions, sort?: SortOption, page?: number, search?: string) => 
    [...PRODUCT_QUERY_KEYS.lists(), { filters, sort, page, search }] as const,
  details: () => [...PRODUCT_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PRODUCT_QUERY_KEYS.details(), id] as const,
  featured: () => [...PRODUCT_QUERY_KEYS.all, 'featured'] as const,
  filterOptions: () => [...PRODUCT_QUERY_KEYS.all, 'filter-options'] as const,
};

// Public product hooks (no authentication required)
export const useProducts = (params?: {
  filters?: FilterOptions;
  sort?: SortOption;
  page?: number;
  limit?: number;
  search?: string;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: PRODUCT_QUERY_KEYS.list(params?.filters, params?.sort, params?.page, params?.search),
    queryFn: () => productService.getProducts(params),
    enabled: params?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useProduct = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: PRODUCT_QUERY_KEYS.detail(id),
    queryFn: () => productService.getProductById(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useFeaturedProducts = (limit: number = 8) => {
  return useQuery({
    queryKey: PRODUCT_QUERY_KEYS.featured(),
    queryFn: () => productService.getFeaturedProducts(limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useFilterOptions = () => {
  return useQuery({
    queryKey: PRODUCT_QUERY_KEYS.filterOptions(),
    queryFn: () => productService.getFilterOptions(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

// Admin product hooks (authentication required)
export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (productData: BackendProductCreate) =>
      adminProductService.createProduct(productData),
    onSuccess: (newProduct) => {
      // Invalidate and refetch product lists
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.featured() });
      
      toast({
        title: "创建成功",
        description: "新产品已添加",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "创建失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, productData }: { id: string; productData: Partial<Product> }) =>
      adminProductService.updateProduct(id, productData),
    onSuccess: (updatedProduct) => {
      // Update the specific product in cache
      queryClient.setQueryData(
        PRODUCT_QUERY_KEYS.detail(updatedProduct.id),
        updatedProduct
      );
      
      // Invalidate product lists to reflect changes
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.featured() });
      
      toast({
        title: "保存成功",
        description: "产品信息已更新",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => adminProductService.deleteProduct(id),
    onSuccess: (_, deletedId) => {
      // Remove the product from cache
      queryClient.removeQueries({ queryKey: PRODUCT_QUERY_KEYS.detail(deletedId) });
      
      // Invalidate product lists
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.featured() });
      
      toast({
        title: "删除成功",
        description: "产品已成功删除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUploadProductImages = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ productId, files }: { productId: string; files: File[] }) =>
      adminProductService.uploadProductImages(productId, files),
    onSuccess: (result, { productId }) => {
      // Invalidate the specific product to refetch with new images
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.detail(productId) });
      
      toast({
        title: "图片上传成功",
        description: `已成功上传 ${result.images.length} 张图片`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "图片上传失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteProductImage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ productId, imageId }: { productId: string; imageId: string }) =>
      adminProductService.deleteProductImage(productId, imageId),
    onSuccess: (_, { productId }) => {
      // Invalidate the specific product to refetch without the deleted image
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.detail(productId) });
      
      toast({
        title: "图片删除成功",
        description: "图片已成功删除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "图片删除失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
