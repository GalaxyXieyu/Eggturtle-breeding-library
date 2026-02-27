import { z } from 'zod';

export const seriesCodeSchema = z.string().trim().min(1).max(120);
export const seriesNameSchema = z.string().trim().min(1).max(120);

export const seriesSummarySchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  code: seriesCodeSchema,
  name: seriesNameSchema,
  sortOrder: z.number().int(),
  isActive: z.boolean()
});

export const seriesSchema = seriesSummarySchema.extend({
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const listSeriesQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const listSeriesResponseSchema = z.object({
  items: z.array(seriesSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(1)
});

export const getSeriesResponseSchema = z.object({
  series: seriesSchema
});

export type Series = z.infer<typeof seriesSchema>;
export type SeriesSummary = z.infer<typeof seriesSummarySchema>;
export type ListSeriesQuery = z.infer<typeof listSeriesQuerySchema>;
