import { z } from 'zod'

export const AuditAction = {
  ProductCreate: 'product.create',
  ProductUpdate: 'product.update',
  ProductEventCreate: 'product.event.create',
  ProductImageUpload: 'product.image.upload',
  ProductImageDelete: 'product.image.delete',
  ProductImageSetMain: 'product.image.set_main',
  ProductImageReorder: 'product.image.reorder',
  ProductCertificateConfirm: 'product.certificate.confirm',
  ProductCertificateVoid: 'product.certificate.void',
  ProductCertificateReissue: 'product.certificate.reissue',
  ProductCouplePhotoGenerate: 'product.couple_photo.generate',
  SaleBatchCreate: 'sale.batch.create',
  SaleAllocationCreate: 'sale.allocation.create',
  SaleSubjectMediaUpload: 'sale.subject_media.upload',
  ShareCreate: 'share.create',
  ShareAccess: 'share.access',
  SubscriptionActivationRedeem: 'subscription.activation.redeem',
  AuthLogin: 'auth.login'
} as const

export const auditActionSchema = z.enum([
  AuditAction.ProductCreate,
  AuditAction.ProductUpdate,
  AuditAction.ProductEventCreate,
  AuditAction.ProductImageUpload,
  AuditAction.ProductImageDelete,
  AuditAction.ProductImageSetMain,
  AuditAction.ProductImageReorder,
  AuditAction.ProductCertificateConfirm,
  AuditAction.ProductCertificateVoid,
  AuditAction.ProductCertificateReissue,
  AuditAction.ProductCouplePhotoGenerate,
  AuditAction.SaleBatchCreate,
  AuditAction.SaleAllocationCreate,
  AuditAction.SaleSubjectMediaUpload,
  AuditAction.ShareCreate,
  AuditAction.ShareAccess,
  AuditAction.SubscriptionActivationRedeem,
  AuditAction.AuthLogin
])

export const auditLogSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  actorUserId: z.string().min(1),
  action: auditActionSchema,
  resourceType: z.string().trim().min(1).max(120),
  resourceId: z.string().trim().min(1).nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string().datetime()
})

export const listAuditLogsQuerySchema = z.object({
  tenantId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})

export const listAuditLogsResponseSchema = z.object({
  logs: z.array(auditLogSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(1)
})

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction]
export type AuditLog = z.infer<typeof auditLogSchema>
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>
export type ListAuditLogsResponse = z.infer<typeof listAuditLogsResponseSchema>
