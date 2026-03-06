import { z } from 'zod';

const nullableMoneySchema = z
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

const optionalBooleanLikeSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    if (value === 'true' || value === '1') {
      return true;
    }
    if (value === 'false' || value === '0') {
      return false;
    }
  }
  return value;
}, z.boolean().optional());

export const certificateQuotaSchema = z.object({
  monthKey: z.string().regex(/^\d{6}$/),
  limit: z.number().int().positive(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
});

export const productCertificateEligibilityRequirementsSchema = z.object({
  hasSireCode: z.boolean(),
  hasDamCode: z.boolean(),
  hasParentGrandparentTrace: z.boolean(),
});

export const getProductCertificateEligibilityResponseSchema = z.object({
  eligible: z.boolean(),
  reasons: z.array(z.string().min(1)),
  requirements: productCertificateEligibilityRequirementsSchema,
  quota: certificateQuotaSchema,
});

export const saleBatchStatusSchema = z.enum(['OPEN', 'PARTIAL', 'SOLD', 'CLOSED']);
export const saleAllocationStatusSchema = z.enum(['SOLD', 'CANCELLED']);
export const productCertificateStatusSchema = z.enum(['ISSUED', 'VOID_SUPERSEDED', 'VOID_MANUAL']);

export const saleAllocationSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  saleBatchId: z.string().min(1),
  allocationNo: z.string().min(1).max(120),
  status: saleAllocationStatusSchema,
  quantity: z.number().int().positive(),
  buyerName: z.string().min(1).max(120),
  buyerAccountId: z.string().nullable(),
  buyerContact: z.string().nullable(),
  unitPrice: z.number().finite().nonnegative().nullable(),
  channel: z.string().nullable(),
  campaignId: z.string().nullable(),
  note: z.string().nullable(),
  soldAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const saleSubjectMediaSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  femaleProductId: z.string().min(1),
  saleBatchId: z.string().min(1),
  label: z.string().nullable(),
  contentType: z.string().nullable(),
  sizeBytes: z.string().regex(/^\d+$/),
  isPrimary: z.boolean(),
  contentPath: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const saleBatchSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  femaleProductId: z.string().min(1),
  eggEventId: z.string().min(1),
  batchNo: z.string().min(1).max(120),
  status: saleBatchStatusSchema,
  plannedQuantity: z.number().int().positive(),
  soldQuantity: z.number().int().nonnegative(),
  remainingQuantity: z.number().int().nonnegative(),
  eventDateSnapshot: z.string().datetime(),
  eggCountSnapshot: z.number().int().nonnegative().nullable(),
  femaleCodeSnapshot: z.string().min(1).max(120),
  sireCodeSnapshot: z.string().min(1).max(120),
  seriesNameSnapshot: z.string().nullable(),
  priceLow: z.number().finite().nonnegative().nullable(),
  priceHigh: z.number().finite().nonnegative().nullable(),
  note: z.string().nullable(),
  allocations: z.array(saleAllocationSchema),
  subjectMedia: z.array(saleSubjectMediaSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const listSaleBatchesResponseSchema = z.object({
  items: z.array(saleBatchSchema),
});

export const createSaleBatchRequestSchema = z.object({
  eggEventId: z.string().trim().min(1).max(120),
  plannedQuantity: z.coerce.number().int().positive().max(999),
  priceLow: nullableMoneySchema,
  priceHigh: nullableMoneySchema,
  note: z.string().trim().max(5000).nullable().optional(),
});

export const createSaleBatchResponseSchema = z.object({
  batch: saleBatchSchema,
});

export const createSaleAllocationRequestSchema = z.object({
  saleBatchId: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().int().positive().max(999),
  buyerName: z.string().trim().min(1).max(120),
  buyerAccountId: z.string().trim().max(120).nullable().optional(),
  buyerContact: z.string().trim().max(120).nullable().optional(),
  unitPrice: nullableMoneySchema,
  channel: z.string().trim().max(80).nullable().optional(),
  campaignId: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(5000).nullable().optional(),
  soldAt: z.string().trim().datetime().optional(),
});

export const createSaleAllocationResponseSchema = z.object({
  allocation: saleAllocationSchema,
  batch: saleBatchSchema,
});

export const createSaleSubjectMediaRequestSchema = z.object({
  saleBatchId: z.string().trim().min(1).max(120),
  label: z.string().trim().max(120).nullable().optional(),
  isPrimary: optionalBooleanLikeSchema,
});

export const createSaleSubjectMediaResponseSchema = z.object({
  media: saleSubjectMediaSchema,
  batch: saleBatchSchema,
});

export const productCertificateGenerateRequestSchema = z.object({
  eggEventId: z.string().trim().min(1).max(120),
  saleBatchId: z.string().trim().min(1).max(120),
  saleAllocationId: z.string().trim().min(1).max(120),
  subjectMediaId: z.string().trim().min(1).max(120),
  templateVersion: z.string().trim().min(1).max(40).optional(),
  buyerName: z.string().trim().min(1).max(120).optional(),
  buyerAccountId: z.string().trim().min(1).max(120).optional(),
});

export const reissueProductCertificateRequestSchema = z.object({
  subjectMediaId: z.string().trim().min(1).max(120).optional(),
  templateVersion: z.string().trim().min(1).max(40).optional(),
  voidReason: z.string().trim().min(1).max(240).optional(),
});

export const voidProductCertificateRequestSchema = z.object({
  voidReason: z.string().trim().min(1).max(240).optional(),
});

export const productCertificatePreviewSchema = z.object({
  certNo: z.string().min(1).max(120),
  verifyId: z.string().min(1).max(40),
  mimeType: z.literal('image/png'),
  imageBase64: z.string().min(1),
});

export const generateProductCertificatePreviewResponseSchema = z.object({
  preview: productCertificatePreviewSchema,
  quota: certificateQuotaSchema,
});

export const productCertificateSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  productId: z.string().min(1),
  eggEventId: z.string().nullable(),
  saleBatchId: z.string().nullable(),
  saleAllocationId: z.string().nullable(),
  subjectMediaId: z.string().nullable(),
  previousCertificateId: z.string().nullable(),
  versionNo: z.number().int().positive(),
  voidReason: z.string().nullable(),
  certNo: z.string().min(1).max(120),
  verifyId: z.string().min(1).max(40),
  status: productCertificateStatusSchema,
  templateVersion: z.string().trim().min(1).max(40),
  lineageSnapshot: z.unknown(),
  saleSnapshot: z.unknown().nullable(),
  watermarkSnapshot: z.unknown().nullable(),
  contentType: z.string().nullable(),
  sizeBytes: z.string().regex(/^\d+$/),
  contentPath: z.string().min(1),
  issuedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const confirmProductCertificateGenerateResponseSchema = z.object({
  certificate: productCertificateSchema,
  quota: certificateQuotaSchema,
});

export const listProductCertificatesResponseSchema = z.object({
  items: z.array(productCertificateSchema),
});

export const productCertificateCenterItemSchema = z.object({
  certificate: productCertificateSchema,
  femaleCode: z.string().min(1),
  productName: z.string().nullable(),
  batchNo: z.string().nullable(),
  allocationNo: z.string().nullable(),
  buyerName: z.string().nullable(),
  channel: z.string().nullable(),
  subjectContentPath: z.string().nullable(),
  eggEventDate: z.string().datetime().nullable(),
});

export const listProductCertificateCenterQuerySchema = z.object({
  productId: z.string().trim().min(1).max(120).optional(),
  status: productCertificateStatusSchema.optional(),
  batchId: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listProductCertificateCenterResponseSchema = z.object({
  items: z.array(productCertificateCenterItemSchema),
});

export const generateProductCouplePhotoRequestSchema = z.object({
  templateVersion: z.string().trim().min(1).max(40).optional(),
  channel: z.string().trim().max(80).optional(),
  campaignId: z.string().trim().max(120).optional(),
});

export const productCouplePhotoSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  femaleProductId: z.string().min(1),
  maleProductIdSnapshot: z.string().nullable(),
  femaleCodeSnapshot: z.string().min(1).max(120),
  maleCodeSnapshot: z.string().min(1).max(120),
  templateVersion: z.string().trim().min(1).max(40),
  watermarkSnapshot: z.unknown().nullable(),
  priceSnapshot: z.number().finite().nonnegative().nullable(),
  isCurrent: z.boolean(),
  staleReason: z.string().nullable(),
  contentType: z.string().nullable(),
  sizeBytes: z.string().regex(/^\d+$/),
  contentPath: z.string().min(1),
  generatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const generateProductCouplePhotoResponseSchema = z.object({
  photo: productCouplePhotoSchema,
});

export const getCurrentProductCouplePhotoResponseSchema = z.object({
  photo: productCouplePhotoSchema.nullable(),
});

export const listProductCouplePhotosResponseSchema = z.object({
  items: z.array(productCouplePhotoSchema),
});

export const verifyProductCertificateResponseSchema = z.object({
  certificate: z.object({
    id: z.string().min(1),
    verifyId: z.string().min(1).max(40),
    certNo: z.string().min(1).max(120),
    status: productCertificateStatusSchema,
    versionNo: z.number().int().positive(),
    issuedAt: z.string().datetime(),
    tenantName: z.string().min(1),
    productCode: z.string().min(1),
    productName: z.string().nullable(),
    lineageSnapshot: z.unknown(),
    saleSnapshot: z.unknown().nullable(),
    watermarkSnapshot: z.unknown().nullable(),
    contentPath: z.string().min(1),
    subjectContentPath: z.string().nullable(),
    batch: z
      .object({
        id: z.string().min(1),
        batchNo: z.string().min(1),
        status: saleBatchStatusSchema,
        plannedQuantity: z.number().int().positive(),
        soldQuantity: z.number().int().nonnegative(),
        eventDateSnapshot: z.string().datetime(),
        eggCountSnapshot: z.number().int().nonnegative().nullable(),
        priceLow: z.number().finite().nonnegative().nullable(),
        priceHigh: z.number().finite().nonnegative().nullable(),
      })
      .nullable(),
    allocation: z
      .object({
        id: z.string().min(1),
        allocationNo: z.string().min(1),
        buyerName: z.string().min(1),
        buyerAccountId: z.string().nullable(),
        buyerContact: z.string().nullable(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().finite().nonnegative().nullable(),
        channel: z.string().nullable(),
        campaignId: z.string().nullable(),
        soldAt: z.string().datetime(),
      })
      .nullable(),
  }),
});

export type CertificateQuota = z.infer<typeof certificateQuotaSchema>;
export type ProductCertificateEligibilityRequirements = z.infer<
  typeof productCertificateEligibilityRequirementsSchema
>;
export type GetProductCertificateEligibilityResponse = z.infer<
  typeof getProductCertificateEligibilityResponseSchema
>;
export type SaleBatchStatus = z.infer<typeof saleBatchStatusSchema>;
export type SaleAllocationStatus = z.infer<typeof saleAllocationStatusSchema>;
export type ProductCertificateStatus = z.infer<typeof productCertificateStatusSchema>;
export type SaleAllocation = z.infer<typeof saleAllocationSchema>;
export type SaleSubjectMedia = z.infer<typeof saleSubjectMediaSchema>;
export type SaleBatch = z.infer<typeof saleBatchSchema>;
export type CreateSaleBatchRequest = z.infer<typeof createSaleBatchRequestSchema>;
export type CreateSaleAllocationRequest = z.infer<typeof createSaleAllocationRequestSchema>;
export type CreateSaleSubjectMediaRequest = z.infer<typeof createSaleSubjectMediaRequestSchema>;
export type ProductCertificateGenerateRequest = z.infer<
  typeof productCertificateGenerateRequestSchema
>;
export type ReissueProductCertificateRequest = z.infer<
  typeof reissueProductCertificateRequestSchema
>;
export type VoidProductCertificateRequest = z.infer<typeof voidProductCertificateRequestSchema>;
export type ProductCertificatePreview = z.infer<typeof productCertificatePreviewSchema>;
export type GenerateProductCertificatePreviewResponse = z.infer<
  typeof generateProductCertificatePreviewResponseSchema
>;
export type ProductCertificate = z.infer<typeof productCertificateSchema>;
export type ConfirmProductCertificateGenerateResponse = z.infer<
  typeof confirmProductCertificateGenerateResponseSchema
>;
export type ListProductCertificatesResponse = z.infer<typeof listProductCertificatesResponseSchema>;
export type ListProductCertificateCenterQuery = z.infer<
  typeof listProductCertificateCenterQuerySchema
>;
export type ListProductCertificateCenterResponse = z.infer<
  typeof listProductCertificateCenterResponseSchema
>;
export type ProductCertificateCenterItem = z.infer<typeof productCertificateCenterItemSchema>;
export type GenerateProductCouplePhotoRequest = z.infer<
  typeof generateProductCouplePhotoRequestSchema
>;
export type ProductCouplePhoto = z.infer<typeof productCouplePhotoSchema>;
export type GenerateProductCouplePhotoResponse = z.infer<
  typeof generateProductCouplePhotoResponseSchema
>;
export type GetCurrentProductCouplePhotoResponse = z.infer<
  typeof getCurrentProductCouplePhotoResponseSchema
>;
export type ListProductCouplePhotosResponse = z.infer<typeof listProductCouplePhotosResponseSchema>;
export type VerifyProductCertificateResponse = z.infer<
  typeof verifyProductCertificateResponseSchema
>;
