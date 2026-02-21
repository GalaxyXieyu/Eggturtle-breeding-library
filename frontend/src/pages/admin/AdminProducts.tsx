import React, { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Product, ProductImage } from "@/types/products";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useUploadProductImages, PRODUCT_QUERY_KEYS } from "@/hooks/useProducts";
import { useQueryClient } from "@tanstack/react-query";
import { adminProductService } from "@/services/productService";
import { useRequireAuth } from "@/hooks/useAuth";
import { turtleAlbumService } from "@/services/turtleAlbumService";
import { createImageUrl } from "@/lib/api";
import type { Series } from "@/types/turtleAlbum";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationInfo,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Upload,
  Image as ImageIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import { ProductsToolbar } from "./products/ProductsToolbar";
import { TurtleFilters } from "./products/TurtleFilters";
import { ProductsTableDesktop } from "./products/ProductsTableDesktop";
import { ProductsListMobile } from "./products/ProductsListMobile";
import { sortProductsByField } from "./products/utils/sort";

import { ProductSheet } from "./products/ProductSheet";
import { ProductDetailView } from "./products/ProductDetailView";

import { ProductImagesManager } from "./products/images/ProductImagesManager";
import { useProductImages } from "./products/images/useProductImages";

import { ProductCreateDialog } from "./products/forms/ProductCreateDialog";
import { ProductEditForm } from "./products/forms/ProductEditForm";
import type { ProductFormValues } from "./products/forms/productSchema";

const AdminProducts = () => {
  // Protect admin route
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Product | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [listFilters, setListFilters] = useState<{ sex?: string; series_id?: string }>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Series state
  const [seriesList, setSeriesList] = useState<Series[]>([]);

  // API hooks
  const { data: apiProductsData, isLoading: productsLoading, error: productsError } = useProducts({
    enabled: isAuthenticated,
    page: currentPage,
    limit: itemsPerPage,
    search: searchQuery.trim() || undefined,
    filters: listFilters,
  });
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const uploadImagesMutation = useUploadProductImages();

  const syncProductImages = (productId: string, images: ProductImage[]) => {
    setSelectedProduct((prev) => (prev && prev.id === productId ? { ...prev, images } : prev));
    setFilteredProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, images } : p)));

    queryClient.setQueryData(
      PRODUCT_QUERY_KEYS.detail(productId),
      (oldData: Product | undefined) => (oldData ? { ...oldData, images } : oldData)
    );

    queryClient.setQueriesData(
      { queryKey: PRODUCT_QUERY_KEYS.lists() },
      (oldData: { products?: Product[] } | undefined) => {
        if (!oldData?.products) return oldData;
        return {
          ...oldData,
          products: oldData.products.map((p) => (p.id === productId ? { ...p, images } : p)),
        };
      }
    );
  };

  const images = useProductImages({
    toast,
    editApi: {
      uploadImages: async ({ productId, files }) =>
        uploadImagesMutation.mutateAsync({ productId, files }),
      deleteImage: async ({ productId, imageId }) =>
        adminProductService.deleteProductImage(productId, imageId),
      reorderImages: async ({ productId, orders }) =>
        adminProductService.reorderProductImages(productId, orders),
      setMainImage: async ({ productId, imageId }) =>
        adminProductService.setMainProductImage(productId, imageId),
      onImagesSynced: ({ productId, images }) => syncProductImages(productId, images),
    },
  });

  // Use API data
  const products = apiProductsData?.products || [];
  const totalProducts = apiProductsData?.total || 0;
  const totalPages = apiProductsData?.totalPages || 1;
  const getPrimaryImageUrl = (product: Product): string | null => {
    if (!product.images || product.images.length === 0) return null;
    const mainImage = product.images.find((img) => img.type === "main") || product.images[0];
    return mainImage?.url ? createImageUrl(mainImage.url) : null;
  };

  // Local state for filtered products
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products);

  // Fetch series list
  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const series = await turtleAlbumService.listSeries();
        setSeriesList(series);
      } catch (error) {
        console.error('Failed to fetch series:', error);
      }
    };
    if (isAuthenticated) {
      fetchSeries();
    }
  }, [isAuthenticated]);

  // Update filtered products when products data changes
  useEffect(() => {
    setFilteredProducts(products);
  }, [products]);

  // Show error toast if API call fails
  useEffect(() => {
    if (productsError) {
      toast({
        title: "加载失败",
        description: "获取产品列表时发生错误",
        variant: "destructive",
      });
    }
  }, [productsError, toast]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    itemsPerPage,
  ]);

  // Generate page numbers for display (with ellipsis for long lists)
  const getPageNumbers = () => {
    const pageNumbers: Array<number | "ellipsis"> = [];

    pageNumbers.push(1);

    if (currentPage > 3) {
      pageNumbers.push("ellipsis");
    }

    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i !== 1 && i !== totalPages) {
        pageNumbers.push(i);
      }
    }

    if (currentPage < totalPages - 2) {
      pageNumbers.push("ellipsis");
    }

    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }
    return pageNumbers;
  };

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Handle sort (compute next direction synchronously; don't rely on setState timing)
  const handleSort = (field: keyof Product) => {
    const nextDirection: "asc" | "desc" =
      sortField === field ? (sortDirection === "asc" ? "desc" : "asc") : "asc";

    setSortField(field);
    setSortDirection(nextDirection);

    setFilteredProducts(sortProductsByField([...filteredProducts], field, nextDirection));
  };

  // Image handling extracted to products/images/*

  // Handle view product details
  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsEditMode(false);
    setIsProductDetailOpen(true);

    images.initFromProduct(product);
  };

  // Handle edit product
  const handleEditProduct = async (product: Product) => {
    setSelectedProduct(product);
    setIsEditMode(true);
    setIsProductDetailOpen(true);

    images.initFromProduct(product);
  };

  // Handle delete product
  const handleDeleteProduct = (productId: string) => {
    if (confirm("确定要删除该产品吗？此操作不可逆。")) {
      deleteProductMutation.mutate(productId);
    }
  };

  const handleCreateProduct = async (values: ProductFormValues) => {
    try {
      // First create the product without images
      const backendProductData = {
        name: values.name,
        code: values.code,
        description: values.description || "",
        stage: values.stage,
        status: values.status,
        series_id: values.seriesId?.trim() || null,
        sex: values.sex || null,
        offspring_unit_price: values.sex === 'female' ? values.offspringUnitPrice ?? null : null,
        sire_code: values.sireCode?.trim() || null,
        dam_code: values.damCode?.trim() || null,
        has_sample: values.hasSample,
        cost_price: 0, // Default value, can be updated later
        price: 0, // Default value, can be updated later
        in_stock: values.inStock,
        popularity_score: values.popularityScore,
        images: [] // Create product without images first
      };

      createProductMutation.mutate(backendProductData, {
        onSuccess: async (response) => {
          let created = response as Product;

          // Upload images (create mode stores previews; upload after product is created)
          if (response?.id) {
            const filesToUpload = images.getFilesForCreate();
            if (filesToUpload.length > 0) {
              try {
                const uploaded = await uploadImagesMutation.mutateAsync({
                  productId: response.id,
                  files: filesToUpload,
                });
                created = { ...response, images: uploaded.images };
              } catch (error) {
                console.error("Failed to upload images:", error);
              }
            }
          }

          // After creation, jump into edit/detail view so images can be managed (set main/delete/reorder).
          setIsCreateDialogOpen(false);

          if (created?.id) {
            setSelectedProduct(created);
            setIsEditMode(true);
            setIsProductDetailOpen(true);
            images.initFromProduct(created);
          }
        }
      });
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  };

  const handleSaveProduct = (values: ProductFormValues) => {
    if (!selectedProduct) return;

    const updatedProductData = {
      name: values.name,
      code: values.code,
      description: values.description || "",
      stage: values.stage,
      status: values.status,
      series_id: values.seriesId?.trim() || null,
      sex: values.sex || null,
      offspring_unit_price: values.sex === 'female' ? values.offspringUnitPrice ?? null : null,
      sire_code: values.sireCode?.trim() || null,
      dam_code: values.damCode?.trim() || null,
      has_sample: values.hasSample,
      in_stock: values.inStock,
      popularity_score: values.popularityScore,
      is_featured: values.isFeatured
    };

    updateProductMutation.mutate(
      { id: selectedProduct.id, productData: updatedProductData },
      {
        onSuccess: async () => {
          // Save image order if there are images
          if (images.imageUploads.length > 0 && images.flags.hasImageOrderChanged) {
            await images.saveOrder({ productId: selectedProduct.id });
          }

          setIsProductDetailOpen(false);
          images.reset();
        }
      }
    );
  };

  const toggleFunctionalDesign = (design: any) => {
    // This function is no longer needed but keeping stub for now
  };


  const productDetails =
    selectedProduct && !isEditMode ? (
      <ProductDetailView
        product={selectedProduct}
        imageUploads={images.imageUploads}
        currentImageIndex={images.currentImageIndex}
        onPrevImage={images.handlePrevImage}
        onNextImage={images.handleNextImage}
        onSelectImageIndex={images.setCurrentImageIndex}
        onClose={() => setIsProductDetailOpen(false)}
        onEdit={() => setIsEditMode(true)}
      />
    ) : null;

  // Show loading state while authenticating or loading products
  if (authLoading || productsLoading) {
    return (
      <AdminLayout title="产品管理">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="产品管理">
      {/* Sticky Search and Actions Bar */}
      <div className="sticky top-0 z-10 bg-neutral-50 pb-4 mb-2">
        <ProductsToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onImportSuccess={() => queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.lists() })}
          onCreateClick={() => {
            images.reset();
            setIsCreateDialogOpen(true);
          }}
        />

        <TurtleFilters
          filters={listFilters}
          seriesList={seriesList}
          onChange={(next) => {
            setListFilters(next);
            setCurrentPage(1);
          }}
          onClear={() => {
            setListFilters({});
            setCurrentPage(1);
          }}
        />
      </div>

      <ProductsTableDesktop
        products={filteredProducts}
        totalProducts={totalProducts}
        seriesList={seriesList}
        getPrimaryImageUrl={getPrimaryImageUrl}
        onView={handleViewProduct}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        onSort={handleSort}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={setItemsPerPage}
        onPageChange={handlePageChange}
      />

      <ProductsListMobile
        products={filteredProducts}
        seriesList={seriesList}
        getPrimaryImageUrl={getPrimaryImageUrl}
        onView={handleViewProduct}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {/* Product Detail/Edit Sheet */}
      <ProductSheet
        open={isProductDetailOpen}
        onOpenChange={setIsProductDetailOpen}
        isEditMode={isEditMode}
        detail={productDetails}
        edit={
          selectedProduct && isEditMode ? (
            <ProductEditForm
              product={selectedProduct}
              onSubmit={handleSaveProduct}
              onCancel={() => {
                setIsEditMode(false);
                images.initFromProduct(selectedProduct);
              }}
              isSaving={updateProductMutation.isPending}
              images={
                <ProductImagesManager
                  mode="edit"
                  productId={selectedProduct.id}
                  images={images}
                />
              }
            />
          ) : null
        }
        
      />

      <ProductCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateProduct}
        isSaving={createProductMutation.isPending}
        images={<ProductImagesManager mode="create" images={images} />}
        onCancel={() => images.reset()}
      />

    </AdminLayout>
  );
};

export default AdminProducts;
