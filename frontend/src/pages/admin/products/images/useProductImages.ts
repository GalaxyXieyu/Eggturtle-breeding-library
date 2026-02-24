import { useCallback, useMemo, useRef, useState } from "react";

import type { Product, ProductImage } from "@/types/products";

export type ProductImageUpload = {
  file: File;
  preview: string;
  id: string;
  type?: "main" | "gallery" | "dimensions" | "detail";
};

export type ToastFn = (args: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

type EditModeApi = {
  uploadImages: (args: { productId: string; files: File[] }) => Promise<{ images: ProductImage[] }>;
  deleteImage: (args: { productId: string; imageId: string }) => Promise<void>;
  reorderImages: (args: {
    productId: string;
    orders: { id: string; sort_order: number }[];
  }) => Promise<{ images: ProductImage[] }>;
  setMainImage: (args: { productId: string; imageId: string }) => Promise<{ images: ProductImage[] }>;
  onImagesSynced: (args: { productId: string; images: ProductImage[] }) => void;
};

export type UseProductImagesArgs = {
  toast: ToastFn;
  // Optional; only needed for edit-mode actions.
  editApi?: EditModeApi;
};

export function useProductImages({ toast, editApi }: UseProductImagesArgs) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageUploads, setImageUploads] = useState<ProductImageUpload[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasImageOrderChanged, setHasImageOrderChanged] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const currentUpload = imageUploads[currentImageIndex];

  const normalizeImagesForUi = useCallback((images: ProductImage[]): ProductImage[] => {
    const sorted = [...(images || [])].sort((a, b) => {
      const aMain = a.type === "main" ? 0 : 1;
      const bMain = b.type === "main" ? 0 : 1;
      if (aMain !== bMain) return aMain - bMain;

      const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
      const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
      if (ao !== bo) return ao - bo;

      return a.id.localeCompare(b.id);
    });

    // For UI interactions we treat array order as source-of-truth.
    return sorted.map((img, index) => ({ ...img, sort_order: index }));
  }, []);

  const reset = useCallback(() => {
    setImageUploads([]);
    setCurrentImageIndex(0);
    setHasImageOrderChanged(false);
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const initFromProduct = useCallback(
    (product: Product) => {
      if (product.images && product.images.length > 0) {
        const normalizedImages = normalizeImagesForUi(product.images);

        const initialUploads: ProductImageUpload[] = normalizedImages.map((img) => ({
          id: img.id,
          preview: img.url,
          type: img.type,
          // Placeholder file object; used to keep a consistent shape.
          file: new File([], "existing-image", { type: "image/jpeg" }),
        }));

        setImageUploads(initialUploads);
        setCurrentImageIndex(0);
        setHasImageOrderChanged(false);
        return;
      }
      reset();
    },
    [normalizeImagesForUi, reset]
  );

  const getFilesForCreate = useCallback(() => {
    // In create mode we only want the actual selected files.
    return imageUploads.filter((u) => u.file.size > 0).map((u) => u.file);
  }, [imageUploads]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleNextImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev < imageUploads.length - 1 ? prev + 1 : prev));
  }, [imageUploads.length]);

  const handlePrevImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const addFilesAsPreviews = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const newUpload: ProductImageUpload = {
            file,
            preview: reader.result as string,
            id: Math.random().toString(36).substring(2, 9),
          };
          setImageUploads((prev) => [...prev, newUpload]);
        };
        reader.readAsDataURL(file);
      });

      toast({
        title: "图片已选择",
        description: `已选择 ${files.length} 张图片，创建产品后会自动上传（系统会自动裁成 1:1）`,
      });
    },
    [toast]
  );

  const handleSelectFiles = useCallback(
    async (args: { mode: "create" | "edit"; productId?: string; files: File[] }) => {
      if (!args.files.length) return;

      // Reset the input so the same file can be selected again if needed.
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (args.mode === "edit") {
        if (!editApi) {
          throw new Error("editApi is required for edit-mode image operations");
        }
        if (!args.productId) {
          throw new Error("productId is required for edit-mode image operations");
        }

        try {
          const result = await editApi.uploadImages({
            productId: args.productId,
            files: args.files,
          });

          // Backend should return the full image list; if it returns only newly-created images,
          // merge with the current UI state so existing images do not disappear.
          const existingImages: ProductImage[] = imageUploads.map((u, index) => ({
            id: u.id,
            url: u.preview,
            alt: "",
            type: u.type || "gallery",
            sort_order: index,
          }));

          const returnedImages: ProductImage[] = (result.images || []).map((img, index) => ({
            id: img.id,
            url: img.url,
            alt: img.alt || "",
            type: img.type || "gallery",
            sort_order: typeof img.sort_order === "number" ? img.sort_order : index,
          }));

          const existingIds = new Set(existingImages.map((img) => img.id));
          const returnedIncludesExisting = returnedImages.some((img) => existingIds.has(img.id));

          const mergedImages = (() => {
            if (existingImages.length === 0 || returnedIncludesExisting) return returnedImages;

            const byId = new Map<string, ProductImage>();
            existingImages.forEach((img) => byId.set(img.id, img));
            returnedImages.forEach((img) => byId.set(img.id, img));

            const next: ProductImage[] = [];
            const seen = new Set<string>();
            const push = (img: ProductImage) => {
              const resolved = byId.get(img.id);
              if (!resolved) return;
              if (seen.has(resolved.id)) return;
              seen.add(resolved.id);
              next.push(resolved);
            };

            existingImages.forEach(push);
            returnedImages.forEach(push);

            return next;
          })();

          const normalizedMerged = normalizeImagesForUi(mergedImages);

          editApi.onImagesSynced({ productId: args.productId, images: normalizedMerged });
          initFromProduct({ id: args.productId, images: normalizedMerged } as Product);

          toast({
            title: "图片已上传",
            description: `已上传 ${args.files.length} 张图片（系统会自动裁成 1:1）`,
          });
        } catch (error) {
          toast({
            title: "上传失败",
            description: (error as Error).message || "图片上传失败，请重试",
            variant: "destructive",
          });
        }
        return;
      }

      addFilesAsPreviews(args.files);
    },
    [addFilesAsPreviews, editApi, imageUploads, initFromProduct, normalizeImagesForUi, toast]
  );

  const removeImage = useCallback(
    async (args: { mode: "create" | "edit"; productId?: string; imageId: string }) => {
      if (args.mode === "edit") {
        if (!editApi) {
          throw new Error("editApi is required for edit-mode image operations");
        }
        if (!args.productId) {
          throw new Error("productId is required for edit-mode image operations");
        }
        if (!confirm("确定要删除这张图片吗？")) return;

        try {
          await editApi.deleteImage({ productId: args.productId, imageId: args.imageId });
          // The backend is now the source of truth; just refetch via caller updates.
          // We optimistically update local state by filtering.
          setImageUploads((prev) => prev.filter((u) => u.id !== args.imageId));
          toast({ title: "已删除", description: "图片已删除" });
        } catch (error) {
          toast({
            title: "删除失败",
            description: (error as Error).message || "图片删除失败，请重试",
            variant: "destructive",
          });
        }
        return;
      }

      setImageUploads((prev) => {
        const next = prev.filter((u) => u.id !== args.imageId);
        // Keep index in range after removal.
        setCurrentImageIndex((idx) => Math.min(idx, Math.max(0, next.length - 1)));
        return next;
      });
    },
    [editApi, toast]
  );

  const setMainImage = useCallback(
    async (args: { productId: string; imageId: string }) => {
      if (!editApi) {
        throw new Error("editApi is required for edit-mode image operations");
      }

      try {
        const result = await editApi.setMainImage(args);

        // Immediate UI update: ensure main image is pinned to index 0.
        const normalizedAfterSetMain = normalizeImagesForUi(result.images || []);
        editApi.onImagesSynced({ productId: args.productId, images: normalizedAfterSetMain });
        initFromProduct({ id: args.productId, images: normalizedAfterSetMain } as Product);
        setCurrentImageIndex(0);

        // Persist UI order via reorder endpoint.
        try {
          const orders = normalizedAfterSetMain.map((img, index) => ({ id: img.id, sort_order: index }));
          const reorderResult = await editApi.reorderImages({ productId: args.productId, orders });
          const normalizedAfterReorder = normalizeImagesForUi(reorderResult.images || []);
          editApi.onImagesSynced({ productId: args.productId, images: normalizedAfterReorder });
          initFromProduct({ id: args.productId, images: normalizedAfterReorder } as Product);
          setHasImageOrderChanged(false);
          toast({ title: "主图已更新", description: "已将主图置顶并保存排序" });
        } catch (error) {
          setHasImageOrderChanged(true);
          toast({
            title: "主图已更新，但排序保存失败",
            description: "请点击“保存排序”重试",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "设置失败",
          description: (error as Error).message,
          variant: "destructive",
        });
      }
    },
    [editApi, initFromProduct, normalizeImagesForUi, toast]
  );

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", index.toString());

    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();

      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDragOverIndex(null);
        return;
      }

      const next = [...imageUploads];
      const draggedItem = next[draggedIndex];

      next.splice(draggedIndex, 1);
      next.splice(dropIndex, 0, draggedItem);

      setImageUploads(next);

      // Keep current index pointing at the same image.
      setCurrentImageIndex((prev) => {
        if (draggedIndex === prev) return dropIndex;
        if (draggedIndex < prev && dropIndex >= prev) return prev - 1;
        if (draggedIndex > prev && dropIndex <= prev) return prev + 1;
        return prev;
      });

      setDragOverIndex(null);
      setDraggedIndex(null);
      setHasImageOrderChanged(true);

      toast({
        title: "图片顺序已更新",
        description: "您可以继续拖拽调整图片顺序",
      });
    },
    [draggedIndex, imageUploads, toast]
  );

  const saveOrder = useCallback(
    async (args: { productId: string }) => {
      if (!imageUploads.length) return;
      if (!editApi) {
        throw new Error("editApi is required for edit-mode image operations");
      }

      try {
        const orders = imageUploads.map((upload, index) => ({ id: upload.id, sort_order: index }));
        const result = await editApi.reorderImages({ productId: args.productId, orders });

        const normalized = normalizeImagesForUi(result.images || []);
        editApi.onImagesSynced({ productId: args.productId, images: normalized });
        initFromProduct({ id: args.productId, images: normalized } as Product);

        setHasImageOrderChanged(false);
        toast({ title: "图片排序已保存", description: "图片显示顺序已更新" });
      } catch (error) {
        toast({
          title: "保存失败",
          description: "图片排序保存失败，请重试",
          variant: "destructive",
        });
      }
    },
    [editApi, imageUploads, initFromProduct, normalizeImagesForUi, toast]
  );

  const flags = useMemo(
    () => ({
      hasImageOrderChanged,
      draggedIndex,
      dragOverIndex,
    }),
    [dragOverIndex, draggedIndex, hasImageOrderChanged]
  );

  return {
    fileInputRef,

    imageUploads,
    currentImageIndex,
    setCurrentImageIndex,
    currentUpload,

    flags,

    reset,
    initFromProduct,

    triggerFileInput,
    handleSelectFiles,

    handleNextImage,
    handlePrevImage,

    removeImage,
    setMainImage,
    saveOrder,

    getFilesForCreate,

    drag: {
      handleDragStart,
      handleDragEnd,
      handleDragOver,
      handleDragLeave,
      handleDrop,
    },
  };
}
