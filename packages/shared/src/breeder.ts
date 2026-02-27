import { z } from 'zod';

import { seriesSummarySchema } from './series';

export const breederCodeSchema = z.string().trim().min(1).max(120);
export const breederIdParamSchema = z.string().trim().min(1).max(120);

export const breederSchema = z.object({
  id: breederIdParamSchema,
  tenantId: z.string().min(1),
  seriesId: z.string().trim().min(1).max(120),
  code: breederCodeSchema,
  name: z.string().nullable(),
  sex: z.string().nullable(),
  description: z.string().nullable(),
  sireCode: z.string().nullable(),
  damCode: z.string().nullable(),
  mateCode: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  series: seriesSummarySchema.optional()
});

export const listBreedersQuerySchema = z.object({
  seriesId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const listBreedersResponseSchema = z.object({
  items: z.array(breederSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(1)
});

export const getBreederResponseSchema = z.object({
  breeder: breederSchema
});

export const breederEventSchema = z.object({
  id: z.string().trim().min(1).max(120),
  tenantId: z.string().min(1),
  breederId: breederIdParamSchema,
  eventType: z.string().min(1),
  eventDate: z.string().datetime(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const listBreederEventsResponseSchema = z.object({
  events: z.array(breederEventSchema)
});

export const breederFamilyTreeNodeSchema = z.object({
  id: breederIdParamSchema,
  code: breederCodeSchema,
  name: z.string().nullable(),
  sex: z.string().nullable()
});

export const breederFamilyTreeLinkSchema = z.object({
  code: breederCodeSchema,
  breeder: breederFamilyTreeNodeSchema.nullable()
});

export const breederFamilyTreeSchema = z.object({
  self: breederFamilyTreeNodeSchema,
  sire: breederFamilyTreeNodeSchema.nullable(),
  dam: breederFamilyTreeNodeSchema.nullable(),
  mate: breederFamilyTreeNodeSchema.nullable(),
  children: z.array(breederFamilyTreeNodeSchema),
  links: z.object({
    sire: breederFamilyTreeLinkSchema.nullable(),
    dam: breederFamilyTreeLinkSchema.nullable(),
    mate: breederFamilyTreeLinkSchema.nullable()
  }),
  limitations: z.string().min(1)
});

export const getBreederFamilyTreeResponseSchema = z.object({
  tree: breederFamilyTreeSchema
});

export type Breeder = z.infer<typeof breederSchema>;
export type ListBreedersQuery = z.infer<typeof listBreedersQuerySchema>;
export type BreederEvent = z.infer<typeof breederEventSchema>;
export type BreederFamilyTreeLink = z.infer<typeof breederFamilyTreeLinkSchema>;
export type BreederFamilyTree = z.infer<typeof breederFamilyTreeSchema>;
