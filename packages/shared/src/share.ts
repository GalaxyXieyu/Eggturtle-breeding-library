import { z } from 'zod';

import { productFamilyTreeSchema, productImageSchema, productSchema } from './product';

const COLOR_HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_HERO_IMAGES = 10;

const nullableTextSchema = z.string().trim().max(240).nullable();
const nullableShortTextSchema = z.string().trim().max(120).nullable();
const nullableWechatIdSchema = z.string().trim().max(64).nullable();
const colorTokenSchema = z.string().trim().regex(COLOR_HEX_PATTERN);
const shareAssetUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine(
    (value) => value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://'),
    'Share asset URL must be an absolute URL or an absolute path.'
  );

export const tenantSharePresentationSchema = z.object({
  feedTitle: nullableShortTextSchema,
  feedSubtitle: nullableTextSchema,
  brandPrimary: colorTokenSchema.nullable(),
  brandSecondary: colorTokenSchema.nullable(),
  heroImages: z.array(shareAssetUrlSchema).max(MAX_HERO_IMAGES),
  showWechatBlock: z.boolean(),
  wechatQrImageUrl: shareAssetUrlSchema.nullable(),
  wechatId: nullableWechatIdSchema
});

export const sharePresentationOverrideSchema = z.object({
  feedTitle: nullableShortTextSchema.optional(),
  feedSubtitle: nullableTextSchema.optional(),
  brandPrimary: colorTokenSchema.nullable().optional(),
  brandSecondary: colorTokenSchema.nullable().optional(),
  heroImages: z.array(shareAssetUrlSchema).max(MAX_HERO_IMAGES).optional(),
  showWechatBlock: z.boolean().optional(),
  wechatQrImageUrl: shareAssetUrlSchema.nullable().optional(),
  wechatId: nullableWechatIdSchema.optional()
});

export const publicSharePresentationSchema = z.object({
  feedTitle: z.string().trim().min(1).max(120),
  feedSubtitle: z.string().trim().min(1).max(240),
  theme: z.object({
    brandPrimary: colorTokenSchema,
    brandSecondary: colorTokenSchema
  }),
  hero: z.object({
    images: z.array(shareAssetUrlSchema).min(1).max(MAX_HERO_IMAGES)
  }),
  contact: z.object({
    showWechatBlock: z.boolean(),
    wechatQrImageUrl: shareAssetUrlSchema.nullable(),
    wechatId: nullableWechatIdSchema
  })
});

export const getTenantSharePresentationResponseSchema = z.object({
  presentation: tenantSharePresentationSchema
});

export const updateTenantSharePresentationRequestSchema = z.object({
  presentation: tenantSharePresentationSchema
});

export const updateTenantSharePresentationResponseSchema = z.object({
  presentation: tenantSharePresentationSchema
});

export const shareResourceTypeSchema = z.enum(['tenant_feed']);

export const createShareRequestSchema = z.object({
  resourceType: shareResourceTypeSchema,
  resourceId: z.string().trim().min(1),
  presentationOverride: sharePresentationOverrideSchema.nullable().optional()
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
  type: z.string().trim().min(1).max(80),
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

export const publicShareDetailEventTypeSchema = z.enum(['mating', 'egg', 'change_mate']);

export const publicShareDetailEventSchema = z.object({
  id: z.string().min(1),
  eventType: publicShareDetailEventTypeSchema,
  eventDate: z.string().datetime().nullable(),
  maleCode: z.string().nullable().optional(),
  eggCount: z.number().int().nullable().optional(),
  note: z.string().nullable().optional(),
  oldMateCode: z.string().nullable().optional(),
  newMateCode: z.string().nullable().optional()
});

export const publicShareMateLoadStatusSchema = z.enum(['normal', 'need_mating', 'warning']);

export const publicShareMateLoadItemSchema = z.object({
  femaleId: z.string().min(1),
  femaleCode: z.string().min(1),
  femaleMainImageUrl: z.string().nullable().optional(),
  femaleThumbnailUrl: z.string().nullable().optional(),
  lastEggAt: z.string().datetime().nullable(),
  lastMatingWithThisMaleAt: z.string().datetime().nullable(),
  daysSinceEgg: z.number().int().nonnegative().nullable().optional(),
  status: publicShareMateLoadStatusSchema,
  excludeFromBreeding: z.boolean().optional()
});

export const publicShareDetailSchema = z.object({
  events: z.array(publicShareDetailEventSchema),
  familyTree: productFamilyTreeSchema.nullable(),
  maleMateLoad: z.array(publicShareMateLoadItemSchema)
});

const publicShareBaseSchema = z.object({
  shareId: z.string().min(1),
  tenant: publicShareTenantSchema,
  expiresAt: z.string().datetime()
});

export const publicTenantFeedShareResponseSchema = publicShareBaseSchema.extend({
  resourceType: z.literal('tenant_feed'),
  presentation: publicSharePresentationSchema,
  items: z.array(publicShareFeedItemSchema),
  product: publicShareProductSchema.nullable().optional(),
  detail: publicShareDetailSchema.nullable().optional()
});

export const publicShareResponseSchema = publicTenantFeedShareResponseSchema;

export type ShareResourceType = z.infer<typeof shareResourceTypeSchema>;
export type CreateShareRequest = z.infer<typeof createShareRequestSchema>;
export type Share = z.infer<typeof shareSchema>;
export type TenantSharePresentation = z.infer<typeof tenantSharePresentationSchema>;
export type SharePresentationOverride = z.infer<typeof sharePresentationOverrideSchema>;
export type PublicSharePresentation = z.infer<typeof publicSharePresentationSchema>;
export type PublicShareQuery = z.infer<typeof publicShareQuerySchema>;
export type PublicShareResponse = z.infer<typeof publicShareResponseSchema>;
export type PublicShareFeedItem = z.infer<typeof publicShareFeedItemSchema>;
export type PublicShareDetail = z.infer<typeof publicShareDetailSchema>;
export type PublicShareDetailEvent = z.infer<typeof publicShareDetailEventSchema>;
export type PublicShareMateLoadItem = z.infer<typeof publicShareMateLoadItemSchema>;
export type UpdateTenantSharePresentationRequest = z.infer<typeof updateTenantSharePresentationRequestSchema>;
