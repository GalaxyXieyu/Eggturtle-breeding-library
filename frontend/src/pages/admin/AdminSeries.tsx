import React, { useEffect, useMemo, useState } from "react";

import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit } from "lucide-react";

import { turtleAlbumService } from "@/services/turtleAlbumService";
import type { Series } from "@/types/turtleAlbum";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "系列名称不能为空"),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0, "排序号不能小于0").optional(),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

const normalize = (s?: string | null) => (s ?? "").trim();

const AdminSeries: React.FC = () => {
  const { isAuthenticated } = useRequireAuth();
  const { toast } = useToast();

  const [series, setSeries] = useState<Series[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selected, setSelected] = useState<Series | null>(null);

  const createForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      sortOrder: 0,
      isActive: true,
    },
  });

  const editForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const sortedSeries = useMemo(() => {
    return [...series].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [series]);

  const fetchSeries = async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const data = await turtleAlbumService.adminListSeries({ includeInactive: true });
      setSeries(data);
    } catch (e) {
      toast({
        title: "加载失败",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSeries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const openEdit = (s: Series) => {
    setSelected(s);
    editForm.reset({
      code: s.code ?? "",
      name: s.name ?? "",
      description: s.description ?? "",
      sortOrder: s.sortOrder ?? 0,
      isActive: !!s.isActive,
    });
    setIsEditOpen(true);
  };

  const onCreate = async (values: FormValues) => {
    try {
      const created = await turtleAlbumService.adminCreateSeries({
        code: normalize(values.code) || null,
        name: normalize(values.name),
        description: normalize(values.description) || null,
        sort_order: values.sortOrder ?? null,
        is_active: values.isActive,
      });
      toast({ title: "创建成功", description: `已创建系列：${created.name}` });
      setIsCreateOpen(false);
      createForm.reset();
      fetchSeries();
    } catch (e) {
      toast({
        title: "创建失败",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  const onUpdate = async (values: FormValues) => {
    if (!selected?.id) return;

    try {
      const updated = await turtleAlbumService.adminUpdateSeries(selected.id, {
        code: normalize(values.code) || null,
        name: normalize(values.name) || null,
        description: normalize(values.description) || null,
        sort_order: values.sortOrder ?? null,
        is_active: values.isActive,
      });
      toast({ title: "更新成功", description: `已更新系列：${updated.name}` });
      setIsEditOpen(false);
      setSelected(null);
      fetchSeries();
    } catch (e) {
      toast({
        title: "更新失败",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout title="系列管理">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="text-sm text-neutral-600">
          用于前台“系列介绍/描述”展示。建议用多行文本，每行一条要点。
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchSeries}
            disabled={isLoading}
            className="border-neutral-300"
          >
            刷新
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-neutral-900 hover:bg-neutral-800">
            <Plus className="h-4 w-4 mr-2" />
            新建系列
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">系列代码</TableHead>
              <TableHead>系列名称</TableHead>
              <TableHead className="w-[90px]">排序</TableHead>
              <TableHead className="w-[110px]">启用</TableHead>
              <TableHead className="w-[160px]">描述</TableHead>
              <TableHead className="w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSeries.map((s) => {
              const hasDesc = normalize(s.description).length > 0;
              return (
                <TableRow key={s.id} className={!s.isActive ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-xs">{s.code || "-"}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.sortOrder ?? 0}</TableCell>
                  <TableCell>{s.isActive ? "是" : "否"}</TableCell>
                  <TableCell>{hasDesc ? "已填写" : "未填写"}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                      <Edit className="h-4 w-4 mr-1" />
                      编辑
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {sortedSeries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-neutral-600 py-8">
                  暂无系列
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>新建系列</DialogTitle>
            <DialogDescription>填写系列描述后，前台会按换行拆分成多条要点。</DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>系列代码（可选）</FormLabel>
                    <FormControl>
                      <Input placeholder="例如 SER-BAIHUA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>系列名称</FormLabel>
                    <FormControl>
                      <Input placeholder="例如 白化" {...field} />
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
                    <FormLabel>系列描述（可选，多行）</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={6}
                        placeholder="每行一条，例如：\n• 体色更浅、对比更强\n• 出壳后颜色会随生长变化\n• 饲养注意事项…"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>排序</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>启用</FormLabel>
                      <div className="flex h-10 items-center">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  取消
                </Button>
                <Button type="submit" className="bg-neutral-900 hover:bg-neutral-800">
                  创建
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>编辑系列</DialogTitle>
            <DialogDescription>修改后会影响前台展示。</DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>系列代码（可选）</FormLabel>
                    <FormControl>
                      <Input placeholder="例如 SER-BAIHUA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>系列名称</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    <FormLabel>系列描述（多行）</FormLabel>
                    <FormControl>
                      <Textarea rows={6} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>排序</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>启用</FormLabel>
                      <div className="flex h-10 items-center">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  取消
                </Button>
                <Button type="submit" className="bg-neutral-900 hover:bg-neutral-800">
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

export default AdminSeries;
