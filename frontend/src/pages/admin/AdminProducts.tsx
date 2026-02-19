import React, { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Product, TubeType, BoxType, FunctionalDesign, Shape, Material, ProcessType, ProductImage } from "@/types/products";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useUploadProductImages, PRODUCT_QUERY_KEYS } from "@/hooks/useProducts";
import { useQueryClient } from "@tanstack/react-query";
import { adminProductService } from "@/services/productService";
import { useRequireAuth } from "@/hooks/useAuth";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

import { ProductImportDialog } from "@/components/admin/ProductImportDialog";

// Image upload interface
interface ProductImageUpload {
  file: File;
  preview: string;
  id: string;
  type?: 'main' | 'gallery' | 'dimensions' | 'detail';
}

// API response interface for filter options
interface FilterOptions {
  tubeTypes: string[];
  boxTypes: string[];
  processTypes: string[];
  functionalDesigns: string[];
  shapes: string[];
  materials: string[];
}

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, "产品名称不能为空"),
  code: z.string().min(1, "货号不能为空"),
  description: z.string().min(1, "产品描述不能为空"),
  material: z.string().min(1, "材质不能为空"),
  shape: z.string().min(1, "形状不能为空"),
  tubeType: z.string().optional(),
  boxType: z.string().optional(),
  processType: z.string().optional(),
  hasSample: z.boolean().default(false),
  boxDimensions: z.string().optional(),
  boxQuantity: z.coerce.number().optional(),
  inStock: z.boolean().default(true),
  popularityScore: z.coerce.number().min(0).max(100).default(0),
  isFeatured: z.boolean().default(false),
  dimensions: z.object({
    weight: z.coerce.number().optional(),
    length: z.coerce.number().optional(),
    width: z.coerce.number().optional(),
    height: z.coerce.number().optional(),
    capacity: z.object({
      min: z.coerce.number().optional(),
      max: z.coerce.number().optional()
    }).optional(),
    compartments: z.coerce.number().min(1).optional()
  }).optional()
});

const AdminProducts = () => {
  // Protect admin route
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Product | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [listFilters, setListFilters] = useState({
    tubeType: "",
    boxType: "",
    material: "",
    shape: "",
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFunctionalDesigns, setSelectedFunctionalDesigns] = useState<FunctionalDesign[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // New state for multiple images
  const [imageUploads, setImageUploads] = useState<ProductImageUpload[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasImageOrderChanged, setHasImageOrderChanged] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // State for dynamic filter options
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    tubeTypes: [],
    boxTypes: [],
    processTypes: [],
    functionalDesigns: [],
    shapes: [],
    materials: []
  });
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // API hooks
  const { data: apiProductsData, isLoading: productsLoading, error: productsError } = useProducts({
    enabled: isAuthenticated,
    page: currentPage,
    limit: itemsPerPage,
    search: searchQuery.trim() || undefined,
    filters: {
      tubeTypes: listFilters.tubeType ? [listFilters.tubeType] : undefined,
      boxTypes: listFilters.boxType ? [listFilters.boxType] : undefined,
      materials: listFilters.material ? [listFilters.material] : undefined,
      shapes: listFilters.shape ? [listFilters.shape] : undefined,
    },
  });
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const uploadImagesMutation = useUploadProductImages();

  // Use API data
  const products = apiProductsData?.products || [];
  const totalProducts = apiProductsData?.total || 0;
  const totalPages = apiProductsData?.totalPages || 1;

  // Local state for filtered products
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products);

  // Fetch filter options from API
  const normalizeFilterValues = (values: unknown): string[] => {
    if (Array.isArray(values)) {
      return values.filter((item): item is string => typeof item === "string" && item.trim() !== "");
    }
    if (values && typeof values === "object") {
      return Object.values(values as Record<string, unknown>)
        .flat()
        .filter((item): item is string => typeof item === "string" && item.trim() !== "");
    }
    return [];
  };

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        setIsLoadingOptions(true);
        const response = await fetch('/api/products/filter-options');
        if (response.ok) {
          const data = await response.json();
          // Convert API response from snake_case to camelCase
          const apiData = data.data;
          setFilterOptions({
            tubeTypes: normalizeFilterValues(apiData.tubeTypes ?? apiData.tube_types).sort(),
            boxTypes: normalizeFilterValues(apiData.boxTypes ?? apiData.box_types).sort(),
            processTypes: normalizeFilterValues(apiData.processTypes ?? apiData.process_types).sort(),
            functionalDesigns: normalizeFilterValues(apiData.functionalDesigns ?? apiData.functional_designs).sort(),
            shapes: normalizeFilterValues(apiData.shapes).sort(),
            materials: normalizeFilterValues(apiData.materials).sort()
          });
        } else {
          console.error('Failed to fetch filter options');
          // Fall back to hardcoded options if API fails
          setFilterOptions({
            tubeTypes: ['口红管', '唇釉管', '固体棒', '睫毛膏瓶', '眼线液瓶', '唇膜瓶', '粉底膏霜瓶', '发际线包材'],
            boxTypes: ['腮红盒', '粉饼高光盒', '散粉盒', '气垫盒'],
            processTypes: ['注塑', '吹瓶'],
            functionalDesigns: ['磁吸', '卡扣', '双头', '双层', '带镜子', '带刷位', '贴片', '多格'],
            shapes: ['圆形', '正方形', '长方形', '椭圆形', '波浪纹', '迷你', '儿童卡通', '不规则'],
            materials: ['AS', 'PETG', 'PS', 'PP']
          });
        }
      } catch (error) {
        console.error('Error fetching filter options:', error);
        // Fall back to hardcoded options
        setFilterOptions({
          tubeTypes: ['口红管', '唇釉管', '固体棒', '睫毛膏瓶', '眼线液瓶', '唇膜瓶', '粉底膏霜瓶', '发际线包材'],
          boxTypes: ['腮红盒', '粉饼高光盒', '散粉盒', '气垫盒'],
          processTypes: ['注塑', '吹瓶'],
          functionalDesigns: ['磁吸', '卡扣', '双头', '双层', '带镜子', '带刷位', '贴片', '多格'],
          shapes: ['圆形', '正方形', '长方形', '椭圆形', '波浪纹', '迷你', '儿童卡通', '不规则'],
          materials: ['AS', 'PETG', 'PS', 'PP']
        });
      } finally {
        setIsLoadingOptions(false);
      }
    };

    if (isAuthenticated) {
      fetchFilterOptions();
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
    listFilters.tubeType,
    listFilters.boxType,
    listFilters.material,
    listFilters.shape,
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

  // Handle sort
  const handleSort = (field: keyof Product) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }

    // Sort products
    const sorted = [...filteredProducts].sort((a, b) => {
      
      const aValue = a[field];
      const bValue = b[field];
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
    
    setFilteredProducts(sorted);
  };

  // Handle image upload
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);

    // Reset the input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Edit mode: upload immediately to backend so the public pages can use it.
    if (selectedProduct && isEditMode) {
      try {
        const result = await uploadImagesMutation.mutateAsync({
          productId: selectedProduct.id,
          files,
        });

        // Refresh local state from backend result
        setSelectedProduct(prev => (prev ? { ...prev, images: result.images } : prev));
        setFilteredProducts(prev => prev.map(p => (p.id === selectedProduct.id ? { ...p, images: result.images } : p)));
        queryClient.setQueryData(
          PRODUCT_QUERY_KEYS.detail(selectedProduct.id),
          (oldData: Product | undefined) => (oldData ? { ...oldData, images: result.images } : oldData)
        );

        initImagesFromProduct({ ...selectedProduct, images: result.images });

        toast({
          title: "图片已上传",
          description: `已上传 ${files.length} 张图片（系统会自动裁成 1:1）`,
        });
      } catch (error) {
        console.error('Failed to upload images:', error);
        toast({
          title: "上传失败",
          description: (error as Error).message || "图片上传失败，请重试",
          variant: "destructive",
        });
      }
      return;
    }

    // Create mode: store previews; upload happens after product is created.
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const newUpload: ProductImageUpload = {
          file,
          preview: reader.result as string,
          id: Math.random().toString(36).substring(2, 9),
        };
        setImageUploads(prev => [...prev, newUpload]);
      };
      reader.readAsDataURL(file);
    });

    toast({
      title: "图片已选择",
      description: `已选择 ${files.length} 张图片，创建产品后会自动上传（系统会自动裁成 1:1）`,
    });
  };

  // Navigate through images
  const handleNextImage = () => {
    if (currentImageIndex < imageUploads.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
  };

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };

  // Remove specific image
  const handleRemoveImage = async (idToRemove: string) => {
    // Edit mode: delete from backend
    if (selectedProduct && isEditMode) {
      if (!confirm("确定要删除这张图片吗？")) return;

      try {
        await adminProductService.deleteProductImage(selectedProduct.id, idToRemove);

        const nextImages = (selectedProduct.images || []).filter(img => img.id !== idToRemove);
        const nextProduct = { ...selectedProduct, images: nextImages };

        setSelectedProduct(nextProduct);
        setFilteredProducts(prev => prev.map(p => (p.id === selectedProduct.id ? { ...p, images: nextImages } : p)));
        queryClient.setQueryData(
          PRODUCT_QUERY_KEYS.detail(selectedProduct.id),
          (oldData: Product | undefined) => (oldData ? { ...oldData, images: nextImages } : oldData)
        );

        initImagesFromProduct(nextProduct);

        toast({
          title: "已删除",
          description: "图片已删除",
        });
      } catch (error) {
        console.error('Failed to delete image:', error);
        toast({
          title: "删除失败",
          description: (error as Error).message || "图片删除失败，请重试",
          variant: "destructive",
        });
      }
      return;
    }

    // Create mode: remove locally
    setImageUploads(prev => {
      const newUploads = prev.filter(upload => upload.id !== idToRemove);

      if (currentImageIndex >= newUploads.length && newUploads.length > 0) {
        setCurrentImageIndex(newUploads.length - 1);
      }

      return newUploads;
    });
  };

  // Move image up in order - 使用拖拽替代
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index.toString());

    // 添加拖拽样式
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  // 拖拽结束
  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
    setDragOverIndex(null);

    // 恢复样式
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  // 拖拽悬停
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  // 拖拽离开
  const handleDragLeave = (e: React.DragEvent) => {
    // 只在真正离开元素时清除 hover 效果
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  };

  // 放置
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    // 重新排序图片
    const newUploads = [...imageUploads];
    const draggedItem = newUploads[draggedIndex];

    // 移除拖拽的项目
    newUploads.splice(draggedIndex, 1);
    // 在新位置插入
    newUploads.splice(dropIndex, 0, draggedItem);

    setImageUploads(newUploads);

    // 如果拖拽的是当前选中的图片，更新选中索引
    if (draggedIndex === currentImageIndex) {
      setCurrentImageIndex(dropIndex);
    } else if (draggedIndex < currentImageIndex && dropIndex >= currentImageIndex) {
      setCurrentImageIndex(currentImageIndex - 1);
    } else if (draggedIndex > currentImageIndex && dropIndex <= currentImageIndex) {
      setCurrentImageIndex(currentImageIndex + 1);
    }

    setDragOverIndex(null);
    setDraggedIndex(null);
    setHasImageOrderChanged(true);

    toast({
      title: "图片顺序已更新",
      description: "您可以继续拖拽调整图片顺序",
    });
  };

  // Move image up in order - 保留原有按钮功能作为备用
  const handleMoveImageUp = (index: number) => {
    if (index > 0) {
      setImageUploads(prev => {
        const newUploads = [...prev];
        [newUploads[index - 1], newUploads[index]] = [newUploads[index], newUploads[index - 1]];

        // Update current index if needed
        if (currentImageIndex === index) {
          setCurrentImageIndex(index - 1);
        } else if (currentImageIndex === index - 1) {
          setCurrentImageIndex(index);
        }

        return newUploads;
      });
      setHasImageOrderChanged(true);
    }
  };

  // Move image down in order - 保留原有按钮功能作为备用
  const handleMoveImageDown = (index: number) => {
    setImageUploads(prev => {
      if (index < prev.length - 1) {
        const newUploads = [...prev];
        [newUploads[index], newUploads[index + 1]] = [newUploads[index + 1], newUploads[index]];

        // Update current index if needed
        if (currentImageIndex === index) {
          setCurrentImageIndex(index + 1);
        } else if (currentImageIndex === index + 1) {
          setCurrentImageIndex(index);
        }

        return newUploads;
      }
      return prev;
    });
    setHasImageOrderChanged(true);
  };

  // Save image order to backend
  const saveImageOrder = async (productId: string) => {
    if (!imageUploads.length) return;

    try {
      const imageOrders = imageUploads.map((upload, index) => ({
        id: upload.id,
        sort_order: index
      }));

      const result = await adminProductService.reorderProductImages(productId, imageOrders);

      setSelectedProduct(prev =>
        prev && prev.id === productId ? { ...prev, images: result.images } : prev
      );
      setFilteredProducts(prev =>
        prev.map(product =>
          product.id === productId ? { ...product, images: result.images } : product
        )
      );
      queryClient.setQueryData(
        PRODUCT_QUERY_KEYS.detail(productId),
        (oldData: Product | undefined) =>
          oldData ? { ...oldData, images: result.images } : oldData
      );
      queryClient.setQueriesData(
        { queryKey: PRODUCT_QUERY_KEYS.lists() },
        (oldData: { products?: Product[] } | undefined) => {
          if (!oldData?.products) return oldData;
          return {
            ...oldData,
            products: oldData.products.map(product =>
              product.id === productId ? { ...product, images: result.images } : product
            ),
          };
        }
      );

      toast({
        title: "图片排序已保存",
        description: "图片显示顺序已更新",
      });
    } catch (error) {
      console.error('Failed to save image order:', error);
      toast({
        title: "保存失败",
        description: "图片排序保存失败，请重试",
        variant: "destructive",
      });
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Reset image state
  const resetImages = () => {
    setImageUploads([]);
    setCurrentImageIndex(0);
  };

  // Initialize images from product
  const initImagesFromProduct = (product: Product) => {
    if (product.images && product.images.length > 0) {
      const initialUploads: ProductImageUpload[] = product.images.map(img => ({
        id: img.id,
        preview: img.url,
        type: img.type,
        file: new File([], "existing-image", { type: "image/jpeg" }) // Placeholder file object
      }));
      setImageUploads(initialUploads);
      setCurrentImageIndex(0);
    } else {
      resetImages();
    }
  };

  // Handle view product details
  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsEditMode(false);
    setIsProductDetailOpen(true);
    
    // Initialize images
    initImagesFromProduct(product);
  };

  // Handle edit product
  const handleEditProduct = async (product: Product) => {
    setSelectedProduct(product);
    setIsEditMode(true);
    setIsProductDetailOpen(true);
    // Handle functionalDesigns being either array or string
    const designs = Array.isArray(product.functionalDesigns) 
      ? product.functionalDesigns 
      : product.functionalDesigns ? [product.functionalDesigns] : [];
    setSelectedFunctionalDesigns(designs);

    editForm.setValue('isFeatured', product.isFeatured);

    // Initialize images
    initImagesFromProduct(product);
  };

  // Handle delete product
  const handleDeleteProduct = (productId: string) => {
    if (confirm("确定要删除该产品吗？此操作不可逆。")) {
      deleteProductMutation.mutate(productId);
    }
  };

  // Init forms
  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      material: "",
      shape: "",
      tubeType: "",
      boxType: "",
      processType: "",
      hasSample: false,
      boxDimensions: "",
      boxQuantity: 0,
      inStock: true,
      popularityScore: 0,
      dimensions: {
        weight: 0,
        length: 0,
        width: 0,
        height: 0,
        capacity: {
          min: 0,
          max: 0
        },
        compartments: 1
      }
    }
  });

  const createForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      material: "",
      shape: "",
      tubeType: "",
      boxType: "",
      processType: "",
      hasSample: false,
      boxDimensions: "",
      boxQuantity: 0,
      inStock: true,
      popularityScore: 0,
      dimensions: {
        weight: 0,
        length: 0,
        width: 0,
        height: 0,
        capacity: {
          min: 0,
          max: 0
        },
        compartments: 1
      }
    }
  });

  useEffect(() => {
    if (selectedProduct && isEditMode) {
      // Update form values when selected product changes
      editForm.reset({
        name: selectedProduct.name,
        code: selectedProduct.code,
        description: selectedProduct.description,
        material: selectedProduct.material,
        shape: selectedProduct.shape,
        tubeType: selectedProduct.tubeType || "",
        boxType: selectedProduct.boxType || "",
        processType: selectedProduct.processType || "",
        hasSample: false,
        boxDimensions: "",
        boxQuantity: 0,
        inStock: selectedProduct.inStock,
        popularityScore: selectedProduct.popularityScore,
        dimensions: {
          weight: selectedProduct.dimensions?.weight || 0,
          length: selectedProduct.dimensions?.length || 0,
          width: selectedProduct.dimensions?.width || 0,
          height: selectedProduct.dimensions?.height || 0,
          capacity: {
            min: selectedProduct.dimensions?.capacity?.min || 0,
            max: selectedProduct.dimensions?.capacity?.max || 0
          },
          compartments: selectedProduct.dimensions?.compartments || 1
        }
      });
      // Handle functionalDesigns being either array or string
      const designs = Array.isArray(selectedProduct.functionalDesigns) 
        ? selectedProduct.functionalDesigns 
        : selectedProduct.functionalDesigns ? [selectedProduct.functionalDesigns] : [];
      setSelectedFunctionalDesigns(designs);

      // Initialize images
      initImagesFromProduct(selectedProduct);
    } else {
      setSelectedFunctionalDesigns([]);
    }
  }, [selectedProduct, editForm, isEditMode]);

  // Convert ImageUpload[] to ProductImage[]
  const convertImagesToProductImages = (uploads: ProductImageUpload[], productName: string): ProductImage[] => {
    return uploads.map((upload, index) => ({
      id: upload.id,
      url: upload.preview,
      alt: `${productName} - Image ${index + 1}`,
      type: index === 0 ? 'main' : 'gallery',
      sort_order: index
    }));
  };

  const handleCreateProduct = async (values: z.infer<typeof formSchema>) => {
    try {
      // First create the product without images
      const backendProductData = {
        name: values.name,
        code: values.code,
        description: values.description || "",
        material: values.material as Material,
        shape: values.shape as Shape,
        tube_type: values.tubeType ? values.tubeType as TubeType : undefined,
        box_type: values.boxType ? values.boxType as BoxType : undefined,
        process_type: values.processType ? values.processType as ProcessType : undefined,
        functional_designs: selectedFunctionalDesigns,
        dimensions: {
          weight: values.dimensions?.weight ? parseFloat(values.dimensions.weight.toString()) : undefined,
          capacity: values.dimensions?.capacity?.min || values.dimensions?.capacity?.max ? {
            min: values.dimensions?.capacity?.min ? parseFloat(values.dimensions.capacity.min.toString()) : 0,
            max: values.dimensions?.capacity?.max ? parseFloat(values.dimensions.capacity.max.toString()) : 0
          } : undefined,
          length: values.dimensions?.length ? parseFloat(values.dimensions.length.toString()) : undefined,
          width: values.dimensions?.width ? parseFloat(values.dimensions.width.toString()) : undefined,
          height: values.dimensions?.height ? parseFloat(values.dimensions.height.toString()) : undefined,
          compartments: values.dimensions?.compartments ? parseInt(values.dimensions.compartments.toString()) : undefined
        },
        has_sample: values.hasSample,
        box_dimensions: values.boxDimensions || undefined,
        box_quantity: values.boxQuantity ?? undefined,
        cost_price: 0, // Default value, can be updated later
        factory_price: 0, // Default value, can be updated later
        in_stock: values.inStock,
        popularity_score: values.popularityScore,
        is_featured: values.isFeatured,
        images: [] // Create product without images first
      };

      createProductMutation.mutate(backendProductData, {
        onSuccess: async (response) => {
          let created = response as Product;

          // Upload images if any
          if (imageUploads.length > 0 && response?.id) {
            const filesToUpload = imageUploads.filter(upload => upload.file.size > 0); // Filter out placeholder files
            if (filesToUpload.length > 0) {
              try {
                const uploaded = await uploadImagesMutation.mutateAsync({
                  productId: response.id,
                  files: filesToUpload.map(upload => upload.file)
                });
                created = { ...response, images: uploaded.images };
              } catch (error) {
                console.error('Failed to upload images:', error);
              }
            }
          }

          // After creation, jump into edit/detail view so images can be managed (set main/delete/reorder).
          setIsCreateDialogOpen(false);
          setSelectedFunctionalDesigns([]);
          createForm.reset();

          if (created?.id) {
            setSelectedProduct(created);
            setIsEditMode(true);
            setIsProductDetailOpen(true);
            initImagesFromProduct(created);
          }
        }
      });
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  };

  const handleSaveProduct = (values: z.infer<typeof formSchema>) => {
    if (!selectedProduct) return;

    const updatedProductData = {
      name: values.name,
      code: values.code,
      description: values.description || "",
      material: values.material as Material,
      shape: values.shape as Shape,
      tube_type: values.tubeType ? values.tubeType as TubeType : undefined,
      box_type: values.boxType ? values.boxType as BoxType : undefined,
      process_type: values.processType ? values.processType as ProcessType : undefined,
      functional_designs: selectedFunctionalDesigns,
      dimensions: {
        ...selectedProduct.dimensions,
        weight: values.dimensions?.weight ? parseFloat(values.dimensions.weight.toString()) : undefined,
        capacity: values.dimensions?.capacity?.min || values.dimensions?.capacity?.max ? {
          min: values.dimensions?.capacity?.min ? parseFloat(values.dimensions.capacity.min.toString()) : 0,
          max: values.dimensions?.capacity?.max ? parseFloat(values.dimensions.capacity.max.toString()) : 0
        } : undefined,
        length: values.dimensions?.length ? parseFloat(values.dimensions.length.toString()) : undefined,
        width: values.dimensions?.width ? parseFloat(values.dimensions.width.toString()) : undefined,
        height: values.dimensions?.height ? parseFloat(values.dimensions.height.toString()) : undefined,
        compartments: values.dimensions?.compartments ? parseInt(values.dimensions.compartments.toString()) : undefined
      },
      has_sample: values.hasSample,
      box_dimensions: values.boxDimensions || undefined,
      box_quantity: values.boxQuantity ?? undefined,
      in_stock: values.inStock,
      popularity_score: values.popularityScore,
      is_featured: values.isFeatured
    };

    updateProductMutation.mutate(
      { id: selectedProduct.id, productData: updatedProductData },
      {
        onSuccess: async () => {
          // Save image order if there are images
          if (imageUploads.length > 0) {
            try {
              await saveImageOrder(selectedProduct.id);
            } catch (error) {
              console.error('Failed to save image order:', error);
            }
          }

          setIsProductDetailOpen(false);
          resetImages();
        }
      }
    );
  };

  const toggleFunctionalDesign = (design: FunctionalDesign) => {
    setSelectedFunctionalDesigns(current => {
      if (current.includes(design)) {
        return current.filter(d => d !== design);
      } else {
        return [...current, design];
      }
    });
  };

  // Prepare image gallery and upload section
  const renderImageGallery = () => {
    return (
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-900 mb-2">产品图片</p>
        
        {/* Image Carousel */}
        {imageUploads.length > 0 ? (
          <div className="mb-4">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
              <img 
                src={imageUploads[currentImageIndex]?.preview} 
                alt="Product preview"
                className="h-full w-full object-cover"
              />
              
              <div className="absolute right-2 top-2 z-10 flex gap-2">
                {selectedProduct && isEditMode ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/90 rounded-full px-3 border-none h-8"
                    onClick={async () => {
                      const img = imageUploads[currentImageIndex];
                      if (!img?.id) return;
                      try {
                        const result = await adminProductService.setMainProductImage(selectedProduct.id, img.id);
                        const nextProduct = { ...selectedProduct, images: result.images };
                        setSelectedProduct(nextProduct);
                        setFilteredProducts(prev => prev.map(p => (p.id === selectedProduct.id ? { ...p, images: result.images } : p)));
                        queryClient.setQueryData(
                          PRODUCT_QUERY_KEYS.detail(selectedProduct.id),
                          (oldData: Product | undefined) => (oldData ? { ...oldData, images: result.images } : oldData)
                        );
                        initImagesFromProduct(nextProduct);
                        toast({ title: "主图已更新" });
                      } catch (e) {
                        toast({ title: "设置失败", description: (e as Error).message, variant: "destructive" });
                      }
                    }}
                  >
                    设为主图
                  </Button>
                ) : null}

                <Button
                  variant="outline" 
                  size="sm"
                  className="bg-white rounded-full p-1 border-none h-8 w-8"
                  onClick={() => handleRemoveImage(imageUploads[currentImageIndex].id)}
                >
                  <X className="h-4 w-4"/>
                </Button>
              </div>
              
              {imageUploads.length > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 border-none h-8 w-8 ${currentImageIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handlePrevImage}
                    disabled={currentImageIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 border-none h-8 w-8 ${currentImageIndex === imageUploads.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleNextImage}
                    disabled={currentImageIndex === imageUploads.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            
            {/* Thumbnails */}
            {imageUploads.length > 1 && (
              <div className="mt-2">
                <div className="text-xs text-gray-700 mb-2 flex items-center gap-1">
                  <GripVertical className="h-3 w-3" />
                  拖拽图片可调整顺序
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {imageUploads.map((upload, index) => (
                    <div
                      key={upload.id}
                      className={`relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 cursor-move transition-all duration-200 ${
                        index === currentImageIndex ? 'border-gray-900' : 'border-transparent'
                      } ${
                        draggedIndex === index ? 'opacity-50 scale-95' : ''
                      } ${
                        dragOverIndex === index ? 'border-gray-900 border-dashed bg-gray-100' : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onClick={() => setCurrentImageIndex(index)}
                      title="拖拽可调整图片顺序"
                    >
                      <img
                        src={upload.preview}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover pointer-events-none"
                      />

                      {/* 拖拽指示器 */}
                      <div className="absolute top-0 right-0 bg-black/20 rounded-bl p-1">
                        <GripVertical className="h-2 w-2 text-white" />
                      </div>

                      {/* 拖拽时的overlay提示 */}
                      {dragOverIndex === index && draggedIndex !== index && (
                        <div className="absolute inset-0 bg-gray-200/50 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-900 bg-white px-1 py-0.5 rounded">
                            放置
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
        
        {/* Upload Button */}
        <div 
          className="border-2 border-dashed border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={triggerFileInput}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleImageChange}
            multiple
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <Upload className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-600">点击上传产品图片</p>
            <p className="text-xs text-gray-500">支持 JPG/PNG/HEIC。上传后系统会自动居中裁切成 1:1。</p>
          </div>
        </div>
      </div>
    );
  };

  // Render Product Details
  const renderProductDetails = () => {
    if (!selectedProduct) return null;
    
    return (
      <div className="mt-6 space-y-6">
        <div>
          {/* Product Image Gallery for Details View */}
          {imageUploads.length > 0 ? (
            <div className="mb-4">
              <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                <img 
                  src={imageUploads[currentImageIndex]?.preview} 
                  alt={selectedProduct.name}
                  className="h-full w-full object-cover"
                />
                
                {imageUploads.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 border-none h-8 w-8 ${currentImageIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={handlePrevImage}
                      disabled={currentImageIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 border-none h-8 w-8 ${currentImageIndex === imageUploads.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={handleNextImage}
                      disabled={currentImageIndex === imageUploads.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              
              {/* Thumbnails */}
              {imageUploads.length > 1 && (
                <div className="mt-2">
                  {isEditMode && (
                    <div className="text-xs text-gray-700 mb-2 flex items-center gap-1">
                      <GripVertical className="h-3 w-3" />
                      拖拽图片可调整顺序
                    </div>
                  )}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {imageUploads.map((upload, index) => (
                      <div
                        key={upload.id}
                        className={`relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all duration-200 ${
                          index === currentImageIndex ? 'border-gray-900' : 'border-transparent'
                        } ${
                          isEditMode ? 'cursor-move' : 'cursor-pointer'
                        } ${
                          draggedIndex === index ? 'opacity-50 scale-95' : ''
                        } ${
                          dragOverIndex === index ? 'border-gray-900 border-dashed bg-gray-100' : ''
                        }`}
                        draggable={isEditMode}
                        onDragStart={isEditMode ? (e) => handleDragStart(e, index) : undefined}
                        onDragEnd={isEditMode ? handleDragEnd : undefined}
                        onDragOver={isEditMode ? (e) => handleDragOver(e, index) : undefined}
                        onDragLeave={isEditMode ? handleDragLeave : undefined}
                        onDrop={isEditMode ? (e) => handleDrop(e, index) : undefined}
                        onClick={() => setCurrentImageIndex(index)}
                        title={isEditMode ? "拖拽可调整图片顺序" : "点击查看图片"}
                      >
                        <img
                          src={upload.preview}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover pointer-events-none"
                        />

                        {/* 拖拽指示器 - 仅编辑模式显示 */}
                        {isEditMode && (
                          <div className="absolute top-0 right-0 bg-black/20 rounded-bl p-1">
                            <GripVertical className="h-2 w-2 text-white" />
                          </div>
                        )}

                        {/* 拖拽时的overlay提示 */}
                        {dragOverIndex === index && draggedIndex !== index && (
                          <div className="absolute inset-0 bg-gray-200/50 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-900 bg-white px-1 py-0.5 rounded">
                              放置
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center mb-4">
              <div className="text-gray-300">
                <Eye className="h-12 w-12" />
              </div>
            </div>
          )}

          <h3 className="text-xl font-medium text-gray-900">
            {selectedProduct.name}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            货号: {selectedProduct.code}
          </p>
        </div>


        <div>
          <p className="text-sm font-medium text-gray-900 mb-1">产品描述</p>
          <p className="text-gray-600 text-sm">
            {selectedProduct.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {selectedProduct.tubeType && (
            <div>
              <p className="text-sm font-medium text-gray-900">管型</p>
              <p className="text-gray-600">{selectedProduct.tubeType}</p>
            </div>
          )}
          {selectedProduct.boxType && (
            <div>
              <p className="text-sm font-medium text-gray-900">盒型</p>
              <p className="text-gray-600">{selectedProduct.boxType}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">材质</p>
            <p className="text-gray-600">{selectedProduct.material}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">形状</p>
            <p className="text-gray-600">{selectedProduct.shape}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-900 mb-1">功能设计</p>
          <div className="flex flex-wrap gap-2">
            {(() => {
              // Handle functionalDesigns being either array or string
              const designs = Array.isArray(selectedProduct.functionalDesigns) 
                ? selectedProduct.functionalDesigns 
                : selectedProduct.functionalDesigns ? [selectedProduct.functionalDesigns] : [];
              
              return designs.map((design, index) => (
                <span
                  key={index}
                  className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs"
                >
                  {design}
                </span>
              ));
            })()}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {selectedProduct.dimensions.weight && (
            <div>
              <p className="text-sm font-medium text-gray-900">重量</p>
              <p className="text-gray-600">{selectedProduct.dimensions.weight}g</p>
            </div>
          )}
          {selectedProduct.dimensions.capacity && (
            <div>
              <p className="text-sm font-medium text-gray-900">容量</p>
              <p className="text-gray-600">
                {selectedProduct.dimensions.capacity.min}-{selectedProduct.dimensions.capacity.max}ml
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {selectedProduct.dimensions.length && (
            <div>
              <p className="text-sm font-medium text-gray-900">长度</p>
              <p className="text-gray-600">{selectedProduct.dimensions.length}mm</p>
            </div>
          )}
          {selectedProduct.dimensions.width && (
            <div>
              <p className="text-sm font-medium text-gray-900">宽度</p>
              <p className="text-gray-600">{selectedProduct.dimensions.width}mm</p>
            </div>
          )}
          {selectedProduct.dimensions.height && (
            <div>
              <p className="text-sm font-medium text-gray-900">高度</p>
              <p className="text-gray-600">{selectedProduct.dimensions.height}mm</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4 mt-8">
          <Button 
            variant="outline" 
            className="border-gray-300 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            onClick={() => setIsProductDetailOpen(false)}
          >
            关闭
          </Button>
          <Button 
            className="bg-gray-900 hover:bg-gray-800 text-white"
            onClick={() => {
              setIsEditMode(true);
            }}
          >
            <Edit className="mr-2 h-4 w-4" />
            编辑产品
          </Button>
        </div>
      </div>
    );
  };

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
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 h-4 w-4" />
          <Input
            placeholder="搜索产品..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-gray-200"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <ProductImportDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.lists() })} />
          <Button
            className="bg-gray-900 hover:bg-gray-800 text-white flex-1 sm:flex-none"
            onClick={() => {
              resetImages();
              setSelectedFunctionalDesigns([]);
              setIsCreateDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            添加产品
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-sm text-gray-700">管型</Label>
          <Select
            value={listFilters.tubeType || "all"}
            onValueChange={(value) =>
              setListFilters(prev => ({ ...prev, tubeType: value === "all" ? "" : value }))
            }
          >
            <SelectTrigger className="bg-white border-gray-200">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {filterOptions.tubeTypes.map((tubeType) => (
                <SelectItem key={tubeType} value={tubeType}>
                  {tubeType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm text-gray-700">盒型</Label>
          <Select
            value={listFilters.boxType || "all"}
            onValueChange={(value) =>
              setListFilters(prev => ({ ...prev, boxType: value === "all" ? "" : value }))
            }
          >
            <SelectTrigger className="bg-white border-gray-200">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {filterOptions.boxTypes.map((boxType) => (
                <SelectItem key={boxType} value={boxType}>
                  {boxType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm text-gray-700">材质</Label>
          <Select
            value={listFilters.material || "all"}
            onValueChange={(value) =>
              setListFilters(prev => ({ ...prev, material: value === "all" ? "" : value }))
            }
          >
            <SelectTrigger className="bg-white border-gray-200">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {filterOptions.materials.map((material) => (
                <SelectItem key={material} value={material}>
                  {material}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm text-gray-700">形状</Label>
          <Select
            value={listFilters.shape || "all"}
            onValueChange={(value) =>
              setListFilters(prev => ({ ...prev, shape: value === "all" ? "" : value }))
            }
          >
            <SelectTrigger className="bg-white border-gray-200">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {filterOptions.shapes.map((shape) => (
                <SelectItem key={shape} value={shape}>
                  {shape}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-gray-300 text-gray-600 hover:bg-gray-200 hover:text-gray-900 w-full"
            onClick={() =>
              setListFilters({
                tubeType: "",
                boxType: "",
                material: "",
                shape: "",
              })
            }
          >
            清除筛选
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">图片</TableHead>
                <TableHead onClick={() => handleSort("name")} className="cursor-pointer">
                  <div className="flex items-center">
                    名称
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort("code")} className="cursor-pointer">
                  <div className="flex items-center">
                    货号
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="h-10 w-10 rounded bg-gray-100 overflow-hidden">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0].url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-gray-300">
                            <Eye className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.code}</TableCell>
                    <TableCell>
                      {product.tubeType || product.boxType || product.processType}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewProduct(product)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    没有找到符合条件的产品
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-t px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600">共 {totalProducts} 条</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">每页</span>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
              <SelectTrigger className="w-20 h-8 bg-white border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {totalPages > 1 && <PaginationInfo currentPage={currentPage} totalPages={totalPages} />}
        </div>
        {totalPages > 1 && (
          <div className="pb-6">
            <Pagination>
              <PaginationContent>
                {currentPage > 1 && (
                  <PaginationItem>
                    <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} />
                  </PaginationItem>
                )}

                {getPageNumbers().map((number, idx) =>
                  number === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={number}>
                      <PaginationLink
                        isActive={currentPage === number}
                        onClick={() => handlePageChange(Number(number))}
                      >
                        {number}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                {currentPage < totalPages && (
                  <PaginationItem>
                    <PaginationNext onClick={() => handlePageChange(currentPage + 1)} />
                  </PaginationItem>
                )}

                {currentPage < totalPages && totalPages > 3 && (
                  <PaginationItem>
                    <PaginationLast onClick={() => handlePageChange(totalPages)} />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Product Detail/Edit Sheet */}
      <Sheet open={isProductDetailOpen} onOpenChange={setIsProductDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isEditMode ? "编辑产品" : "产品详情"}</SheetTitle>
            <SheetDescription>
              {isEditMode ? "编辑产品的详细信息" : "查看产品的详细信息"}
            </SheetDescription>
          </SheetHeader>

          {/* Product Details View */}
          {selectedProduct && !isEditMode && renderProductDetails()}

          {/* Edit Product Form */}
          {selectedProduct && isEditMode && (
            <div className="mt-6">
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleSaveProduct)}>
                  <div className="space-y-4 pb-24">
                    {/* Image Upload Section - Uses the new multi-image component */}
                    {renderImageGallery()}

                    <div className="space-y-6">
                      {/* 基本信息部分 */}
                      <div className="space-y-4 border-b pb-6">
                        <h3 className="text-lg font-medium text-gray-900">基本信息</h3>
                        <FormField
                          control={editForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>产品名称</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="输入产品名称" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={editForm.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>货号</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="输入产品货号" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={editForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>产品描述</FormLabel>
                              <FormControl>
                                <Textarea 
                                  {...field} 
                                  placeholder="输入产品描述"
                                  className="min-h-[100px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={editForm.control}
                          name="material"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>材质</FormLabel>
                                <FormControl>
                                <Combobox
                                  options={filterOptions.materials}
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  placeholder="选择材质"
                                  allowCustom={true}
                                  onAddCustom={(newMaterial) => {
                                    // 添加到本地选项中
                                    setFilterOptions(prev => ({
                                      ...prev,
                                      materials: [...prev.materials, newMaterial].sort()
                                    }));
                                  }}
                                />
                                </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={editForm.control}
                          name="shape"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>形状</FormLabel>
                                <FormControl>
                                <Combobox
                                  options={filterOptions.shapes}
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  placeholder="选择形状"
                                  allowCustom={true}
                                  onAddCustom={(newShape) => {
                                    setFilterOptions(prev => ({
                                      ...prev,
                                      shapes: [...prev.shapes, newShape].sort()
                                    }));
                                  }}
                                />
                                </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={editForm.control}
                            name="tubeType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>管型</FormLabel>
                                  <FormControl>
                                  <Combobox
                                    options={["", ...filterOptions.tubeTypes]}
                                    value={field.value || ""}
                                    onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                                    placeholder="选择管型（可选）"
                                    allowCustom={true}
                                    onAddCustom={(newTubeType) => {
                                      setFilterOptions(prev => ({
                                        ...prev,
                                        tubeTypes: [...prev.tubeTypes, newTubeType].sort()
                                      }));
                                    }}
                                  />
                                  </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={editForm.control}
                            name="boxType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>盒型</FormLabel>
                                  <FormControl>
                                  <Combobox
                                    options={["", ...filterOptions.boxTypes]}
                                    value={field.value || ""}
                                    onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                                    placeholder="选择盒型（可选）"
                                    allowCustom={true}
                                    onAddCustom={(newBoxType) => {
                                      setFilterOptions(prev => ({
                                        ...prev,
                                        boxTypes: [...prev.boxTypes, newBoxType].sort()
                                      }));
                                    }}
                                  />
                                  </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={editForm.control}
                          name="processType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>工艺类型</FormLabel>
                                <FormControl>
                                <Combobox
                                  options={["", ...filterOptions.processTypes]}
                                  value={field.value || ""}
                                  onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                                  placeholder="选择工艺类型（可选）"
                                  allowCustom={true}
                                  onAddCustom={(newProcessType) => {
                                    setFilterOptions(prev => ({
                                      ...prev,
                                      processTypes: [...prev.processTypes, newProcessType].sort()
                                    }));
                                  }}
                                />
                                </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormItem>
                          <FormLabel>功能设计</FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {(filterOptions.functionalDesigns || []).map((design) => (
                              <div
                                key={design}
                                className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
                                  selectedFunctionalDesigns.includes(design)
                                    ? "bg-gray-900 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                                onClick={() => toggleFunctionalDesign(design)}
                              >
                                {selectedFunctionalDesigns.includes(design) && (
                                  <Check className="h-3.5 w-3.5 mr-1 inline-block" />
                                )}
                                {design}
                              </div>
                            ))}
                          </div>
                        </FormItem>

                        {/* Featured Product Toggle */}
                        <FormField
                          control={editForm.control}
                          name="isFeatured"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">精选产品</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                  将此产品标记为精选产品，在首页展示
                                </div>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* 详细参数部分 */}
                      <div className="space-y-4 border-b pb-6">
                        <h3 className="text-lg font-medium text-gray-900">产品尺寸与规格</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={editForm.control}
                            name="dimensions.weight"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>重量 (g)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" step="0.1" placeholder="输入重量" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <FormField
                              control={editForm.control}
                              name="dimensions.capacity.min"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>容量下限 (ml)</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" step="0.1" placeholder="最小" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={editForm.control}
                              name="dimensions.capacity.max"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>容量上限 (ml)</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" step="0.1" placeholder="最大" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={editForm.control}
                            name="dimensions.length"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>长度 (mm)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" step="0.1" placeholder="输入长度" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={editForm.control}
                            name="dimensions.width"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>宽度 (mm)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" step="0.1" placeholder="输入宽度" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={editForm.control}
                            name="dimensions.height"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>高度 (mm)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" step="0.1" placeholder="输入高度" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={editForm.control}
                            name="boxDimensions"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>纸箱尺寸</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="例如: 50x30x20cm" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={editForm.control}
                            name="boxQuantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>装箱数量</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" placeholder="输入装箱数量" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                    
                  </div>
                  <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-white border-t flex justify-end gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-gray-300 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                      onClick={() => {
                        setIsEditMode(false);
                        initImagesFromProduct(selectedProduct);
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      className="bg-gray-900 hover:bg-gray-800 text-white"
                    >
                      保存产品
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Product Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加产品</DialogTitle>
            <DialogDescription>
              填写以下表单添加新产品
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateProduct)}>
              <div className="space-y-4 mt-4">
                {/* Image Upload Section - Uses the new multi-image component */}
                {renderImageGallery()}

                <div className="space-y-6">
                  {/* 基本信息部分 */}
                  <div className="space-y-4 border-b pb-6">
                    <h3 className="text-lg font-medium text-gray-900">基本信息</h3>
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>产品名称</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="输入产品名称" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>货号</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="输入产品货号" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>产品描述</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="输入产品描述"
                              className="min-h-[100px]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="material"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>材质</FormLabel>
                            <FormControl>
                            <Combobox
                              options={filterOptions.materials}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="选择材质"
                              allowCustom={true}
                              onAddCustom={(newMaterial) => {
                                // 添加到本地选项中
                                setFilterOptions(prev => ({
                                  ...prev,
                                  materials: [...prev.materials, newMaterial].sort()
                                }));
                              }}
                            />
                            </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="shape"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>形状</FormLabel>
                            <FormControl>
                            <Combobox
                              options={filterOptions.shapes}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="选择形状"
                              allowCustom={true}
                              onAddCustom={(newShape) => {
                                setFilterOptions(prev => ({
                                  ...prev,
                                  shapes: [...prev.shapes, newShape].sort()
                                }));
                              }}
                            />
                            </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="tubeType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>管型</FormLabel>
                              <FormControl>
                              <Combobox
                                options={["", ...filterOptions.tubeTypes]}
                                value={field.value || ""}
                                onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                                placeholder="选择管型（可选）"
                                allowCustom={true}
                                onAddCustom={(newTubeType) => {
                                  setFilterOptions(prev => ({
                                    ...prev,
                                    tubeTypes: [...prev.tubeTypes, newTubeType].sort()
                                  }));
                                }}
                              />
                              </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createForm.control}
                        name="boxType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>盒型</FormLabel>
                              <FormControl>
                              <Combobox
                                options={["", ...filterOptions.boxTypes]}
                                value={field.value || ""}
                                onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                                placeholder="选择盒型（可选）"
                                allowCustom={true}
                                onAddCustom={(newBoxType) => {
                                  setFilterOptions(prev => ({
                                    ...prev,
                                    boxTypes: [...prev.boxTypes, newBoxType].sort()
                                  }));
                                }}
                              />
                              </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={createForm.control}
                      name="processType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>工艺类型</FormLabel>
                            <FormControl>
                            <Combobox
                              options={["", ...filterOptions.processTypes]}
                              value={field.value || ""}
                              onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                              placeholder="选择工艺类型（可选）"
                              allowCustom={true}
                              onAddCustom={(newProcessType) => {
                                setFilterOptions(prev => ({
                                  ...prev,
                                  processTypes: [...prev.processTypes, newProcessType].sort()
                                }));
                              }}
                            />
                            </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormItem>
                      <FormLabel>功能设计</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {(filterOptions.functionalDesigns || []).map((design) => (
                          <div
                            key={design}
                            className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
                              selectedFunctionalDesigns.includes(design)
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                            onClick={() => toggleFunctionalDesign(design)}
                          >
                            {selectedFunctionalDesigns.includes(design) && (
                              <Check className="h-3.5 w-3.5 mr-1 inline-block" />
                            )}
                            {design}
                          </div>
                        ))}
                      </div>
                    </FormItem>

                    {/* Featured Product Toggle */}
                    <FormField
                      control={createForm.control}
                      name="isFeatured"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">精选产品</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              将此产品标记为精选产品，在首页展示
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* 详细参数部分 */}
                  <div className="space-y-4 border-b pb-6">
                    <h3 className="text-lg font-medium text-gray-900">产品尺寸与规格</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="dimensions.weight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>重量 (g)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.1" placeholder="输入重量" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={createForm.control}
                          name="dimensions.capacity.min"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>容量下限 (ml)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" step="0.1" placeholder="最小" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="dimensions.capacity.max"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>容量上限 (ml)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" step="0.1" placeholder="最大" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={createForm.control}
                        name="dimensions.length"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>长度 (mm)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.1" placeholder="输入长度" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createForm.control}
                        name="dimensions.width"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>宽度 (mm)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.1" placeholder="输入宽度" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createForm.control}
                        name="dimensions.height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>高度 (mm)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.1" placeholder="输入高度" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="boxDimensions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>纸箱尺寸</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="例如: 50x30x20cm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createForm.control}
                        name="boxQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>装箱数量</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" placeholder="输入装箱数量" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-4 mt-8">
                  <Button 
                    type="button"
                    variant="outline" 
                    className="border-gray-300 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetImages();
                    }}
                  >
                    取消
                  </Button>
                  <Button 
                    type="submit"
                    className="bg-gray-900 hover:bg-gray-800 text-white"
                  >
                    添加产品
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminProducts;
