import { z } from 'zod';

import { productImageSchema, productSchema } from './product';

export const shareResourceTypeSchema = z.enum(['product']);

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
  exp: z.string().trim().min(1),
  sig: z.string().trim().min(1)
});

export const publicShareTenantSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1)
});

export const publicShareProductSchema = productSchema.extend({
  images: z.array(productImageSchema)
});

export const publicShareResponseSchema = z.object({
  shareId: z.string().min(1),
  tenant: publicShareTenantSchema,
  resourceType: shareResourceTypeSchema,
  product: publicShareProductSchema,
  expiresAt: z.string().datetime()
});

export type ShareResourceType = z.infer<typeof shareResourceTypeSchema>;
export type CreateShareRequest = z.infer<typeof createShareRequestSchema>;
export type Share = z.infer<typeof shareSchema>;
export type PublicShareQuery = z.infer<typeof publicShareQuerySchema>;
export type PublicShareResponse = z.infer<typeof publicShareResponseSchema>;
