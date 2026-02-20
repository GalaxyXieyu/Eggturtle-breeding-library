import React, { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { Product } from "@/types/products";

import { ProductFormFields } from "./ProductFormFields";
import {
  productFormDefaultValues,
  productFormSchema,
  type ProductFormValues,
} from "./productSchema";

type Props = {
  product: Product;
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
  isSaving?: boolean;
  images: React.ReactNode;
};

export function ProductEditForm({ product, onSubmit, onCancel, isSaving, images }: Props) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: productFormDefaultValues,
  });

  useEffect(() => {
    form.reset({
      ...productFormDefaultValues,
      name: product.name,
      code: product.code,
      seriesId: product.seriesId || "",
      description: product.description,
      inStock: product.inStock,
      popularityScore: product.popularityScore,
      stage: product.stage || "hatchling",
      status: product.status || "active",
      isFeatured: product.isFeatured,
    });
  }, [form, product]);

  return (
    <div className="mt-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 pb-24">
            {images}
            <ProductFormFields control={form.control} />
          </div>

          <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-white border-t flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              className="border-gray-300 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
              onClick={onCancel}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button type="submit" className="bg-gray-900 hover:bg-gray-800 text-white" disabled={isSaving}>
              保存产品
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
