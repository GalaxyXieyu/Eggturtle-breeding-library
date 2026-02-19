import React, { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRequireAuth } from "@/hooks/useAuth";
import { Product } from "@/types/products";
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

  // API functions (placeholder - will be implemented with actual API calls)
  const fetchFeaturedProducts = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement actual API call
      // const response = await fetch('/api/featured-products', { headers: { Authorization: `Bearer ${token}` } });
      // const data = await response.json();
      // setFeaturedProducts(data.data);
      setFeaturedProducts([]); // Placeholder
    } catch (error) {
      toast({
        title: "加载失败",
        description: "获取精选产品列表时发生错误",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableProducts = async () => {
    try {
      // TODO: Implement actual API call
      // const response = await fetch('/api/products');
      // const data = await response.json();
      // setAvailableProducts(data.data.products);
      setAvailableProducts([]); // Placeholder
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
      // TODO: Implement actual API call
      console.log("Adding featured product:", values);
      toast({
        title: "添加成功",
        description: "产品已添加到精选列表",
      });
      setIsAddDialogOpen(false);
      addForm.reset();
      fetchFeaturedProducts();
    } catch (error) {
      toast({
        title: "添加失败",
        description: "添加精选产品时发生错误",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFeaturedProduct = async (featuredId: string) => {
    if (confirm("确定要从精选列表中移除该产品吗？")) {
      try {
        // TODO: Implement actual API call
        console.log("Removing featured product:", featuredId);
        toast({
          title: "移除成功",
          description: "产品已从精选列表中移除",
        });
        fetchFeaturedProducts();
      } catch (error) {
        toast({
          title: "移除失败",
          description: "移除精选产品时发生错误",
          variant: "destructive",
        });
      }
    }
  };

  const handleMoveUp = async (featured: FeaturedProduct) => {
    // TODO: Implement move up logic
    console.log("Moving up:", featured.id);
  };

  const handleMoveDown = async (featured: FeaturedProduct) => {
    // TODO: Implement move down logic
    console.log("Moving down:", featured.id);
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
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">精选产品管理</h1>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            添加精选产品
          </Button>
        </div>

        {/* Featured Products Table */}
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>产品图片</TableHead>
                <TableHead>产品名称</TableHead>
                <TableHead>产品货号</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>价格</TableHead>
                <TableHead>排序</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featuredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    暂无精选产品数据
                  </TableCell>
                </TableRow>
              ) : (
                featuredProducts.map((featured) => (
                  <TableRow key={featured.id}>
                    <TableCell>
                      <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                        {featured.product.images.length > 0 ? (
                          <img 
                            src={featured.product.images[0].url} 
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
                    <TableCell>
                      {featured.product.tubeType || featured.product.boxType || featured.product.processType || "-"}
                    </TableCell>
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
      </div>

      {/* Add Featured Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加精选产品</DialogTitle>
            <DialogDescription>
              选择产品添加到精选列表
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
