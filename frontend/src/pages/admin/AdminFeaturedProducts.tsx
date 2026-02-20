import React, { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRequireAuth } from "@/hooks/useAuth";
import { Product } from "@/types/products";
import { createApiUrl, createImageUrl, API_ENDPOINTS } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Trash2, 
  ArrowUp,
  ArrowDown,
  Search
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Types
interface FeaturedProduct {
  id: string;
  productId: string;
  product: Product;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}

const AdminFeaturedProducts = () => {
  // Protect admin route
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form schema
  const formSchema = z.object({
    productId: z.string().min(1, "请选择产品"),
    sortOrder: z.number().min(0, "排序不能小于0"),
  });

  const addForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: "",
      sortOrder: 0,
    }
  });

  const fetchFeaturedProducts = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(createApiUrl(API_ENDPOINTS.FEATURED_PRODUCTS), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: ApiResponse<FeaturedProduct[]> = await response.json();
      setFeaturedProducts(data.data || []);
    } catch (error) {
      toast({
        title: "加载失败",
        description: "获取活动产品列表时发生错误",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableProducts = async () => {
    try {
      const response = await fetch(createApiUrl(`${API_ENDPOINTS.PRODUCTS}?page=1&limit=1000`));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: ApiResponse<{ products: Product[] }> = await response.json();
      setAvailableProducts(data.data?.products || []);
    } catch (error) {
      toast({
        title: "加载失败",
        description: "获取产品列表时发生错误",
        variant: "destructive",
      });
    }
  };

  const handleAddFeaturedProduct = async (values: z.infer<typeof formSchema>) => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(createApiUrl(API_ENDPOINTS.FEATURED_PRODUCTS), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          product_id: values.productId,
          sort_order: values.sortOrder,
          is_active: true,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || err.message || `HTTP ${response.status}`);
      }
      toast({
        title: "添加成功",
        description: "产品已添加到活动列表",
      });
      setIsAddDialogOpen(false);
      addForm.reset();
      await fetchFeaturedProducts();
    } catch (error) {
      toast({
        title: "添加失败",
        description: error instanceof Error ? error.message : "添加活动产品时发生错误",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFeaturedProduct = async (featuredId: string) => {
    if (confirm("确定要从活动列表中移除该产品吗？")) {
      try {
        const token = localStorage.getItem("admin_token");
        const response = await fetch(createApiUrl(`${API_ENDPOINTS.FEATURED_PRODUCTS}/${featuredId}`), {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.detail || err.message || `HTTP ${response.status}`);
        }
        toast({
          title: "移除成功",
          description: "产品已从活动列表中移除",
        });
        await fetchFeaturedProducts();
      } catch (error) {
        toast({
          title: "移除失败",
          description: error instanceof Error ? error.message : "移除活动产品时发生错误",
          variant: "destructive",
        });
      }
    }
  };

  const handleMoveUp = async (featured: FeaturedProduct) => {
    const sorted = [...featuredProducts].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((item) => item.id === featured.id);
    if (idx <= 0) return;

    const prev = sorted[idx - 1];
    try {
      const token = localStorage.getItem("admin_token");
      const updateSort = async (id: string, sortOrder: number) => {
        const response = await fetch(createApiUrl(`${API_ENDPOINTS.FEATURED_PRODUCTS}/${id}`), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ sort_order: sortOrder }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.detail || err.message || `HTTP ${response.status}`);
        }
      };
      await Promise.all([updateSort(featured.id, prev.sortOrder), updateSort(prev.id, featured.sortOrder)]);
      await fetchFeaturedProducts();
    } catch (error) {
      toast({
        title: "排序失败",
        description: error instanceof Error ? error.message : "上移活动产品失败",
        variant: "destructive",
      });
    }
  };

  const handleMoveDown = async (featured: FeaturedProduct) => {
    const sorted = [...featuredProducts].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((item) => item.id === featured.id);
    if (idx < 0 || idx >= sorted.length - 1) return;

    const next = sorted[idx + 1];
    try {
      const token = localStorage.getItem("admin_token");
      const updateSort = async (id: string, sortOrder: number) => {
        const response = await fetch(createApiUrl(`${API_ENDPOINTS.FEATURED_PRODUCTS}/${id}`), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ sort_order: sortOrder }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.detail || err.message || `HTTP ${response.status}`);
        }
      };
      await Promise.all([updateSort(featured.id, next.sortOrder), updateSort(next.id, featured.sortOrder)]);
      await fetchFeaturedProducts();
    } catch (error) {
      toast({
        title: "排序失败",
        description: error instanceof Error ? error.message : "下移活动产品失败",
        variant: "destructive",
      });
    }
  };

  // Filter available products based on search
  const filteredAvailableProducts = availableProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get products that are not already featured
  const featuredProductIds = featuredProducts.map(fp => fp.productId);
  const nonFeaturedProducts = filteredAvailableProducts.filter(
    product => !featuredProductIds.includes(product.id)
  );

  // Load data on component mount
  React.useEffect(() => {
    if (isAuthenticated) {
      fetchFeaturedProducts();
      fetchAvailableProducts();
    }
  }, [isAuthenticated]);

  if (authLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">活动产品管理</h1>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            添加活动产品
          </Button>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>产品图片</TableHead>
                <TableHead>产品名称</TableHead>
                <TableHead>产品货号</TableHead>
                <TableHead>价格</TableHead>
                <TableHead>排序</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featuredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {isLoading ? "加载中..." : "暂无活动产品数据"}
                  </TableCell>
                </TableRow>
              ) : (
                featuredProducts.map((featured) => (
                  <TableRow key={featured.id}>
                    <TableCell>
                      <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                        {featured.product.images.length > 0 ? (
                          <img 
                            src={createImageUrl(featured.product.images[0].url)}
                            alt={featured.product.images[0].alt}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">无图片</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{featured.product.name}</TableCell>
                    <TableCell>{featured.product.code}</TableCell>
                    <TableCell>¥{featured.product.pricing.factoryPrice.toFixed(2)}</TableCell>
                    <TableCell>{featured.sortOrder}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveUp(featured)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveDown(featured)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFeaturedProduct(featured.id)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {featuredProducts.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
              {isLoading ? "加载中..." : "暂无活动产品数据"}
            </div>
          ) : (
            featuredProducts.map((featured) => (
              <div key={featured.id} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex gap-3">
                  <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                    {featured.product.images.length > 0 ? (
                      <img
                        src={createImageUrl(featured.product.images[0].url)}
                        alt={featured.product.images[0].alt || featured.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">无图片</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{featured.product.name}</p>
                    <p className="text-sm text-gray-600 mt-0.5">货号: {featured.product.code}</p>
                    <div className="mt-1 text-sm text-gray-900 font-medium">
                      ¥{featured.product.pricing.factoryPrice.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">排序: {featured.sortOrder}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveUp(featured)}
                      className="text-gray-600 hover:text-gray-900 h-8 w-8 p-0"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveDown(featured)}
                      className="text-gray-600 hover:text-gray-900 h-8 w-8 p-0"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFeaturedProduct(featured.id)}
                      className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Activity Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加活动产品</DialogTitle>
            <DialogDescription>
              选择产品添加到活动列表
            </DialogDescription>
          </DialogHeader>
          
          {/* Search Products */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="搜索产品..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(handleAddFeaturedProduct)} className="space-y-4">
              <FormField
                control={addForm.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>选择产品</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择要添加的产品" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {nonFeaturedProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addForm.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>排序</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        placeholder="排序号"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  取消
                </Button>
                <Button 
                  type="submit"
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                >
                  添加
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminFeaturedProducts;
