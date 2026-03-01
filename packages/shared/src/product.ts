import { z } from 'zod';

const nullableText = z.string().trim().max(5000).nullable().optional();
const nullableCode = z.string().trim().max(120).nullable().optional();
const nullableSeriesId = z.string().trim().max(120).nullable().optional();
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
export const productNameSchema = z.string().trim().min(1).max(120).nullable().optional();
export const productDescriptionSchema = nullableText;

export const productSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  code: productCodeSchema,
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

export const createProductResponseSchema = z.object({
  product: productSchema
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
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

export type Product = z.infer<typeof productSchema>;
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type ProductImage = z.infer<typeof productImageSchema>;
export type ReorderProductImagesRequest = z.infer<typeof reorderProductImagesRequestSchema>;
