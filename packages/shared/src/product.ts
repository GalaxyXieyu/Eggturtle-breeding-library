import { z } from 'zod';

const nullableText = z.string().trim().max(5000).nullable().optional();
const nullableCode = z.string().trim().max(120).nullable().optional();
const nullableSeriesId = z.string().trim().max(120).nullable().optional();
const nullableType = z.string().trim().max(80).nullable().optional();
const productType = z.string().trim().min(1).max(80);
const nullableSexInput = z.enum(['male', 'female']).nullable().optional();
const nullableSexResponse = z.string().trim().max(20).nullable().optional();
const nullableOffspringUnitPrice = z
  .preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      return Number(value);
    }

    return value;
  }, z.number().finite().nonnegative().nullable())
  .optional();

export const productCodeSchema = z.string().trim().min(1).max(120);
export const productIdParamSchema = z.string().trim().min(1).max(120);
export const productNameSchema = z.string().trim().min(1).max(120).nullable().optional();
export const productDescriptionSchema = nullableText;

export const productSchema = z.object({
  id: productIdParamSchema,
  tenantId: z.string().min(1),
  code: productCodeSchema,
  type: productType,
  name: z.string().nullable(),
  description: z.string().nullable(),
  seriesId: nullableSeriesId,
  sex: nullableSexResponse,
  offspringUnitPrice: nullableOffspringUnitPrice,
  sireCode: nullableCode,
  damCode: nullableCode,
  mateCode: nullableCode,
  excludeFromBreeding: z.boolean().optional(),
  hasSample: z.boolean().optional(),
  inStock: z.boolean().optional(),
  popularityScore: z.number().int().min(0).max(100).optional(),
  isFeatured: z.boolean().optional(),
  coverImageUrl: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

export const createProductRequestSchema = z.object({
  code: productCodeSchema,
  type: nullableType,
  name: productNameSchema,
  description: productDescriptionSchema,
  seriesId: nullableSeriesId,
  sex: nullableSexInput,
  offspringUnitPrice: nullableOffspringUnitPrice,
  sireCode: nullableCode,
  damCode: nullableCode,
  mateCode: nullableCode,
  excludeFromBreeding: z.boolean().optional(),
  hasSample: z.boolean().optional(),
  inStock: z.boolean().optional(),
  popularityScore: z.number().int().min(0).max(100).optional(),
  isFeatured: z.boolean().optional()
});

export const updateProductRequestSchema = createProductRequestSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided for update.'
  });

const eventDateInputSchema = z.string().trim().min(1).max(40);

export const createMatingRecordRequestSchema = z.object({
  femaleProductId: productIdParamSchema,
  maleProductId: productIdParamSchema,
  eventDate: eventDateInputSchema,
  note: z.string().trim().max(5000).nullable().optional()
});

export const createEggRecordRequestSchema = z.object({
  femaleProductId: productIdParamSchema,
  eventDate: eventDateInputSchema,
  eggCount: z.number().int().min(0).max(999).nullable().optional(),
  note: z.string().trim().max(5000).nullable().optional()
});

export const createProductEventRequestSchema = z.object({
  eventType: z.enum(['mating', 'egg', 'change_mate']),
  eventDate: eventDateInputSchema,
  maleCode: z.string().trim().max(120).nullable().optional(),
  eggCount: z.number().int().min(0).max(999).nullable().optional(),
  note: z.string().trim().max(5000).nullable().optional(),
  oldMateCode: z.string().trim().max(120).nullable().optional(),
  newMateCode: z.string().trim().max(120).nullable().optional()
});

export const createProductResponseSchema = z.object({
  product: productSchema
});

export const getProductResponseSchema = z.object({
  product: productSchema
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  code: z.string().trim().min(1).max(120).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  type: z.string().trim().min(1).max(80).optional(),
  sex: z.string().trim().min(1).max(20).optional(),
  seriesId: z.string().trim().min(1).max(120).optional(),
  sortBy: z.enum(['updatedAt', 'code']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional()
});

export const listProductsResponseSchema = z.object({
  products: z.array(productSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(1)
});

export const productImageSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  productId: z.string().min(1),
  key: z.string().min(1),
  url: z.string().min(1),
  contentType: z.string().min(1).nullable(),
  sortOrder: z.number().int().nonnegative(),
  isMain: z.boolean()
});

export const listProductImagesResponseSchema = z.object({
  images: z.array(productImageSchema)
});

export const uploadProductImageResponseSchema = z.object({
  image: productImageSchema
});

export const setMainProductImageResponseSchema = z.object({
  image: productImageSchema
});

export const deleteProductImageResponseSchema = z.object({
  deleted: z.boolean(),
  imageId: z.string().min(1)
});

export const reorderProductImagesRequestSchema = z.object({
  imageIds: z.array(z.string().trim().min(1)).min(1)
});

export const reorderProductImagesResponseSchema = z.object({
  images: z.array(productImageSchema)
});

export const productEventSchema = z.object({
  id: z.string().trim().min(1).max(120),
  tenantId: z.string().min(1),
  productId: productIdParamSchema,
  eventType: z.string().min(1),
  eventDate: z.string().datetime(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProductEventResponseSchema = z.object({
  event: productEventSchema
});

export const listProductEventsResponseSchema = z.object({
  events: z.array(productEventSchema)
});

export const productFamilyTreeNodeSchema = z.object({
  id: productIdParamSchema,
  code: productCodeSchema,
  name: z.string().nullable(),
  sex: z.string().nullable()
});

export const productFamilyTreeLinkSchema = z.object({
  code: productCodeSchema,
  product: productFamilyTreeNodeSchema.nullable()
});

export const productFamilyTreeSchema = z.object({
  self: productFamilyTreeNodeSchema,
  sire: productFamilyTreeNodeSchema.nullable(),
  dam: productFamilyTreeNodeSchema.nullable(),
  mate: productFamilyTreeNodeSchema.nullable(),
  children: z.array(productFamilyTreeNodeSchema),
  links: z.object({
    sire: productFamilyTreeLinkSchema.nullable(),
    dam: productFamilyTreeLinkSchema.nullable(),
    mate: productFamilyTreeLinkSchema.nullable()
  }),
  limitations: z.string().min(1)
});

export const getProductFamilyTreeResponseSchema = z.object({
  tree: productFamilyTreeSchema
});

export const productPublicClicksQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30)
});

export const productPublicClicksSummarySchema = z.object({
  productId: productIdParamSchema,
  totalClicks: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative(),
  days: z.number().int().min(1).max(365),
  lastClickedAt: z.string().datetime().nullable()
});

export const getProductPublicClicksResponseSchema = z.object({
  stats: productPublicClicksSummarySchema
});

export const listProductsPublicClicksQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

export const productPublicClicksItemSchema = z.object({
  productId: productIdParamSchema,
  code: productCodeSchema,
  name: z.string().nullable(),
  totalClicks: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative(),
  lastClickedAt: z.string().datetime().nullable()
});

export const listProductsPublicClicksResponseSchema = z.object({
  days: z.number().int().min(1).max(365),
  items: z.array(productPublicClicksItemSchema)
});

export type Product = z.infer<typeof productSchema>;
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;
export type CreateMatingRecordRequest = z.infer<typeof createMatingRecordRequestSchema>;
export type CreateEggRecordRequest = z.infer<typeof createEggRecordRequestSchema>;
export type CreateProductEventRequest = z.infer<typeof createProductEventRequestSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type ProductImage = z.infer<typeof productImageSchema>;
export type ReorderProductImagesRequest = z.infer<typeof reorderProductImagesRequestSchema>;
export type ProductEvent = z.infer<typeof productEventSchema>;
export type ProductFamilyTreeLink = z.infer<typeof productFamilyTreeLinkSchema>;
export type ProductFamilyTree = z.infer<typeof productFamilyTreeSchema>;
export type ProductPublicClicksQuery = z.infer<typeof productPublicClicksQuerySchema>;
export type ProductPublicClicksSummary = z.infer<typeof productPublicClicksSummarySchema>;
export type ListProductsPublicClicksQuery = z.infer<typeof listProductsPublicClicksQuerySchema>;
export type ProductPublicClicksItem = z.infer<typeof productPublicClicksItemSchema>;
