import { z } from 'zod';

import { productSchema } from './product';
import { tenantSlugSchema } from './tenant';

export const featuredProductItemSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  productId: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  product: productSchema
});

export const listFeaturedProductsResponseSchema = z.object({
  items: z.array(featuredProductItemSchema)
});

export const createFeaturedProductRequestSchema = z.object({
  productId: z.string().trim().min(1),
  sortOrder: z.number().int().min(0).optional()
});

export const createFeaturedProductResponseSchema = z.object({
  item: featuredProductItemSchema
});

export const deleteFeaturedProductResponseSchema = z.object({
  deleted: z.literal(true),
  id: z.string().min(1)
});

export const reorderFeaturedProductsRequestSchema = z
  .object({
    ids: z.array(z.string().trim().min(1)).min(1).optional(),
    productIds: z.array(z.string().trim().min(1)).min(1).optional()
  })
  .refine((value) => Boolean(value.ids || value.productIds), {
    message: 'ids or productIds is required.',
    path: ['ids']
  });

export const reorderFeaturedProductsResponseSchema = z.object({
  items: z.array(featuredProductItemSchema)
});

export const listPublicFeaturedProductsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(8),
  tenantId: z.string().trim().min(1).optional(),
  tenantSlug: tenantSlugSchema.optional()
});

export const listPublicFeaturedProductsResponseSchema = z.object({
  products: z.array(productSchema)
});

export type FeaturedProductItem = z.infer<typeof featuredProductItemSchema>;
export type CreateFeaturedProductRequest = z.infer<typeof createFeaturedProductRequestSchema>;
export type ReorderFeaturedProductsRequest = z.infer<typeof reorderFeaturedProductsRequestSchema>;
export type ListPublicFeaturedProductsQuery = z.infer<typeof listPublicFeaturedProductsQuerySchema>;
