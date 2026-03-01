import React, { useState, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useRequireAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createImageUrl, createApiUrl, API_ENDPOINTS } from "@/lib/api";
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
  Edit, 
  Trash2, 
  Image as ImageIcon,
  Upload,
  X
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
  FormMessage,
} from "@/components/ui/form";

// Types
interface Carousel {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Form schema
const formSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  description: z.string().optional(),
  linkUrl: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().min(0, "排序号不能小于0"),
});

const AdminCarouselManager: React.FC = () => {
  const { isAuthenticated, authLoading } = useRequireAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCarousel, setSelectedCarousel] = useState<Carousel | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Forms
  const createForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      linkUrl: "",
      isActive: true,
      sortOrder: 0,
    },
  });

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  // Image handling
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "文件格式错误",
          description: "请选择 JPG、PNG、GIF 或 WebP 格式的图片",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast({
          title: "文件过大",
          description: "图片大小不能超过 5MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // API functions
  const fetchCarousels = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(createApiUrl(API_ENDPOINTS.CAROUSELS));
      if (response.ok) {
        const data = await response.json();
        setCarousels(data.data || []);
      } else {
        throw new Error('Failed to fetch carousels');
      }
    } catch (error) {
      toast({
        title: "加载失败",
        description: "获取轮播图列表时发生错误",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCarousel = async (values: z.infer<typeof formSchema>) => {
    try {
      const token = localStorage.getItem('admin_token');

      if (!selectedImage) {
        toast({
          title: "创建失败",
          description: "请上传轮播图片",
          variant: "destructive",
        });
        return;
      }

      const formData = new FormData();

      formData.append('title', values.title);
      formData.append('description', values.description || '');
      formData.append('linkUrl', values.linkUrl || '');
      formData.append('isActive', values.isActive.toString());
      formData.append('sortOrder', values.sortOrder.toString());
      formData.append('image', selectedImage);

      const response = await fetch(createApiUrl(API_ENDPOINTS.CAROUSELS), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        await fetchCarousels();
        setIsCreateDialogOpen(false);
        setSelectedImage(null);
        setImagePreview(null);
        createForm.reset();
        toast({ title: "创建成功", description: "轮播图已创建" });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create carousel');
      }
    } catch (error) {
      toast({
        title: "创建失败",
        description: error instanceof Error ? error.message : "创建轮播图时发生错误",
        variant: "destructive",
      });
    }
  };

  const handleEditCarousel = (carousel: Carousel) => {
    setSelectedCarousel(carousel);
    editForm.reset({
      title: carousel.title,
      description: carousel.description || "",
      linkUrl: carousel.linkUrl || "",
      isActive: carousel.isActive,
      sortOrder: carousel.sortOrder,
    });
    setImagePreview(carousel.imageUrl);
    setIsEditDialogOpen(true);
  };

  const handleUpdateCarousel = async (values: z.infer<typeof formSchema>) => {
    if (!selectedCarousel) return;
    
    try {
      const token = localStorage.getItem('admin_token');
      const formData = new FormData();
      
      formData.append('title', values.title);
      formData.append('description', values.description || '');
      formData.append('linkUrl', values.linkUrl || '');
      formData.append('isActive', values.isActive.toString());
      formData.append('sortOrder', values.sortOrder.toString());
      
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      const response = await fetch(createApiUrl(`${API_ENDPOINTS.CAROUSELS}/${selectedCarousel.id}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        await fetchCarousels();
        setIsEditDialogOpen(false);
        setSelectedCarousel(null);
        setSelectedImage(null);
        setImagePreview(null);
        toast({ title: "更新成功", description: "轮播图已更新" });
      } else {
        throw new Error('Failed to update carousel');
      }
    } catch (error) {
      toast({
        title: "更新失败",
        description: "更新轮播图时发生错误",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCarousel = async (carouselId: string) => {
    if (confirm("确定要删除该轮播图吗？此操作不可逆。")) {
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) {
          toast({
            title: "删除失败",
            description: "未找到认证令牌，请重新登录",
            variant: "destructive",
          });
          return;
        }

        const response = await fetch(createApiUrl(`${API_ENDPOINTS.CAROUSELS}/${carouselId}`), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          await fetchCarousels();
          toast({ title: "删除成功", description: "轮播图已删除" });
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `HTTP ${response.status}: 删除失败`);
        }
      } catch (error) {
        toast({
          title: "删除失败",
          description: error instanceof Error ? error.message : "删除轮播图时发生错误",
          variant: "destructive",
        });
      }
    }
  };

  // Load carousels on component mount
  React.useEffect(() => {
    if (isAuthenticated) {
      fetchCarousels();
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">轮播图管理</h1>
          <Button 
            onClick={() => {
              setSelectedImage(null);
              setImagePreview(null);
              createForm.reset();
              setIsCreateDialogOpen(true);
            }}
            className="bg-gray-900 hover:bg-gray-800 text-white w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            添加轮播图
          </Button>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>预览</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>排序</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carousels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {isLoading ? "加载中..." : "暂无轮播图数据"}
                  </TableCell>
                </TableRow>
              ) : (
                carousels.map((carousel) => (
                  <TableRow key={carousel.id}>
                    <TableCell>
                      <div className="w-16 h-10 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                        {carousel.imageUrl ? (
                          <img
                            src={createImageUrl(carousel.imageUrl)}
                            alt={carousel.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <ImageIcon className={`h-6 w-6 text-gray-400 ${carousel.imageUrl ? 'hidden' : ''}`} />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{carousel.title}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {carousel.description || "-"}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        carousel.isActive 
                          ? "bg-green-100 text-green-800" 
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {carousel.isActive ? "启用" : "禁用"}
                      </span>
                    </TableCell>
                    <TableCell>{carousel.sortOrder}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCarousel(carousel)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCarousel(carousel.id)}
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
          {carousels.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
              {isLoading ? "加载中..." : "暂无轮播图数据"}
            </div>
          ) : (
            carousels.map((carousel) => (
              <div key={carousel.id} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex gap-3">
                  <div className="w-24 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                    {carousel.imageUrl ? (
                      <img
                        src={createImageUrl(carousel.imageUrl)}
                        alt={carousel.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <ImageIcon className={`h-6 w-6 text-gray-400 ${carousel.imageUrl ? 'hidden' : ''}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{carousel.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5 truncate">{carousel.description || "—"}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className={`px-2 py-1 rounded-full ${
                        carousel.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                      }`}>
                        {carousel.isActive ? "启用" : "禁用"}
                      </span>
                      <span className="text-gray-500">排序: {carousel.sortOrder}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditCarousel(carousel)}
                    className="text-gray-600 hover:text-gray-900 h-8"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCarousel(carousel.id)}
                    className="text-red-500 hover:text-red-700 h-8"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    删除
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加轮播图</DialogTitle>
            <DialogDescription>
              创建新的轮播图项目
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateCarousel)} className="space-y-4">
              {/* Image Upload Section */}
              <div className="space-y-4">
                <FormLabel>轮播图片</FormLabel>

                {imagePreview ? (
                  <div className="relative">
                    <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 bg-white rounded-full p-1 border-none h-8 w-8"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4"/>
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-lg p-8 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={triggerFileInput}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Upload className="h-10 w-10 text-gray-300" />
                      <p className="text-sm text-gray-600">点击上传轮播图片</p>
                      <p className="text-xs text-gray-500">支持 JPG, PNG, GIF 格式</p>
                    </div>
                  </div>
                )}
              </div>

              <FormField
                control={createForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标题</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="输入轮播图标题" />
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
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="输入轮播图描述（可选）" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="linkUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>链接URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="输入点击跳转链接（可选）" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>启用状态</FormLabel>
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

                <FormField
                  control={createForm.control}
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
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                >
                  创建
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑轮播图</DialogTitle>
            <DialogDescription>
              修改轮播图信息
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdateCarousel)} className="space-y-4">
              {/* Image Upload Section */}
              <div className="space-y-4">
                <FormLabel>轮播图片</FormLabel>

                {imagePreview ? (
                  <div className="relative">
                    <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 bg-white rounded-full p-1 border-none h-8 w-8"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4"/>
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-lg p-8 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={triggerFileInput}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Upload className="h-10 w-10 text-gray-300" />
                      <p className="text-sm text-gray-600">点击上传轮播图片</p>
                      <p className="text-xs text-gray-500">支持 JPG, PNG, GIF 格式</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Same form fields as create dialog */}
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标题</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="输入轮播图标题" />
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
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="输入轮播图描述（可选）" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="linkUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>链接URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="输入点击跳转链接（可选）" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>启用状态</FormLabel>
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

                <FormField
                  control={editForm.control}
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
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                >
                  保存
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCarouselManager;
