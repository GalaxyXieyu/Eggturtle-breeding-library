import React, { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { ProductFormFields } from "./ProductFormFields";
import {
  productFormDefaultValues,
  productFormSchema,
  type ProductFormValues,
} from "./productSchema";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProductFormValues) => void;
  isSaving?: boolean;
  images: React.ReactNode;
  onCancel?: () => void;
};

export function ProductCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  isSaving,
  images,
  onCancel,
}: Props) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: productFormDefaultValues,
  });

  useEffect(() => {
    if (!open) {
      form.reset(productFormDefaultValues);
    }
  }, [form, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加产品</DialogTitle>
          <DialogDescription>填写以下表单添加新产品</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => {
              onSubmit(values);
            })}
          >
            <div className="space-y-4 mt-4">
              {images}
              <ProductFormFields control={form.control} mode="create" />

              <div className="flex justify-end gap-4 mt-8">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  onClick={() => {
                    onOpenChange(false);
                    onCancel?.();
                  }}
                  disabled={isSaving}
                >
                  取消
                </Button>
                <Button type="submit" className="bg-gray-900 hover:bg-gray-800 text-white" disabled={isSaving}>
                  添加产品
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
