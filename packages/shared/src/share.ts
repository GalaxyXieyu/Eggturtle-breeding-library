import { z } from 'zod';

import { productImageSchema, productSchema } from './product';

export const shareResourceTypeSchema = z.enum(['product', 'tenant_feed']);

export const createShareRequestSchema = z.object({
  resourceType: shareResourceTypeSchema,
  resourceId: z.string().trim().min(1)
});

export const shareSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  resourceType: shareResourceTypeSchema,
  resourceId: z.string().min(1),
  shareToken: z.string().min(1),
  entryUrl: z.string().url(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createShareResponseSchema = z.object({
  share: shareSchema
});

export const publicShareQuerySchema = z.object({
  tenantId: z.string().trim().min(1),
  resourceType: shareResourceTypeSchema,
  resourceId: z.string().trim().min(1),
  productId: z.string().trim().min(1).optional(),
  exp: z.string().trim().min(1),
  sig: z.string().trim().min(1)
});

export const publicShareTenantSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1)
});

export const publicShareFeedItemSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().nullable(),
  description: z.string().nullable(),
  seriesId: z.string().nullable(),
  sex: z.string().nullable(),
  offspringUnitPrice: z.number().finite().nonnegative().nullable(),
  coverImageUrl: z.string().nullable(),
  popularityScore: z.number().int().min(0).max(100),
  isFeatured: z.boolean()
});

export const publicShareProductSchema = productSchema.extend({
  images: z.array(productImageSchema)
});

const publicShareBaseSchema = z.object({
  shareId: z.string().min(1),
  tenant: publicShareTenantSchema,
  expiresAt: z.string().datetime()
});

export const publicProductShareResponseSchema = publicShareBaseSchema.extend({
  resourceType: z.literal('product'),
  product: publicShareProductSchema
});

export const publicTenantFeedShareResponseSchema = publicShareBaseSchema.extend({
  resourceType: z.literal('tenant_feed'),
  items: z.array(publicShareFeedItemSchema),
  product: publicShareProductSchema.nullable().optional()
});

export const publicShareResponseSchema = z.discriminatedUnion('resourceType', [
  publicProductShareResponseSchema,
  publicTenantFeedShareResponseSchema
]);

export type ShareResourceType = z.infer<typeof shareResourceTypeSchema>;
export type CreateShareRequest = z.infer<typeof createShareRequestSchema>;
export type Share = z.infer<typeof shareSchema>;
export type PublicShareQuery = z.infer<typeof publicShareQuerySchema>;
export type PublicShareResponse = z.infer<typeof publicShareResponseSchema>;
export type PublicShareFeedItem = z.infer<typeof publicShareFeedItemSchema>;
