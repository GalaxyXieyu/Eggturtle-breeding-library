import { z } from 'zod';

export const AuditAction = {
  ProductCreate: 'product.create',
  ProductImageUpload: 'product.image.upload',
  ProductImageDelete: 'product.image.delete',
  ProductImageSetMain: 'product.image.set_main',
  ProductImageReorder: 'product.image.reorder',
  ShareCreate: 'share.create',
  ShareAccess: 'share.access'
} as const;

export const auditActionSchema = z.enum([
  AuditAction.ProductCreate,
  AuditAction.ProductImageUpload,
  AuditAction.ProductImageDelete,
  AuditAction.ProductImageSetMain,
  AuditAction.ProductImageReorder,
  AuditAction.ShareCreate,
  AuditAction.ShareAccess
]);

export const auditLogSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  actorUserId: z.string().min(1),
  action: auditActionSchema,
  resourceType: z.string().trim().min(1).max(120),
  resourceId: z.string().trim().min(1).nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string().datetime()
});

export const listAuditLogsQuerySchema = z.object({
  tenantId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const listAuditLogsResponseSchema = z.object({
  logs: z.array(auditLogSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(1)
});

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
export type AuditLog = z.infer<typeof auditLogSchema>;
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
export type ListAuditLogsResponse = z.infer<typeof listAuditLogsResponseSchema>;
