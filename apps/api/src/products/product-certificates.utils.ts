import type {
  CertificateQuota,
  ProductCertificate,
  ProductCertificateCenterItem,
  ProductCertificateEligibilityRequirements
} from '@eggturtle/shared'
import { Prisma } from '@prisma/client'
import type {
  Product as PrismaProduct,
  ProductCertificate as PrismaProductCertificateModel,
  SaleAllocation as PrismaSaleAllocationModel,
  SaleBatch as PrismaSaleBatchModel,
  SaleSubjectMedia as PrismaSaleSubjectMediaModel
} from '@prisma/client'
import { randomUUID } from 'node:crypto'

export type CertificateLineageContext = {
  tenantId: string
  tenantName: string
  product: PrismaProduct
  saleBatch: PrismaSaleBatchModel | null
  saleAllocation: PrismaSaleAllocationModel | null
  subjectMedia: PrismaSaleSubjectMediaModel | null
  seriesName: string | null
  sireProduct: PrismaProduct | null
  subjectImageKey: string | null
  sireImageKey: string | null
  damImageKey: string | null
  requirements: ProductCertificateEligibilityRequirements
}

export function buildCertificateEligibilityReasons(
  requirements: ProductCertificateEligibilityRequirements,
  quota?: CertificateQuota
): string[] {
  const reasons: string[] = []

  if (!requirements.hasSireCode) {
    reasons.push('缺少父本编号（sireCode）。')
  }

  if (!requirements.hasDamCode) {
    reasons.push('缺少母本编号（damCode）。')
  }

  if (!requirements.hasParentGrandparentTrace) {
    reasons.push('父系或母系至少需要一侧具备祖代追溯信息。')
  }

  if (quota && quota.remaining <= 0) {
    reasons.push(`当月证书额度已用完（${quota.used}/${quota.limit}）。`)
  }

  return reasons
}

export function buildCertificateLineageSnapshot(
  context: CertificateLineageContext,
  templateVersion: string
): Prisma.JsonObject {
  return {
    generatedAt: new Date().toISOString(),
    template: templateVersion,
    female: {
      id: context.product.id,
      code: context.product.code,
      name: context.product.name,
      sex: context.product.sex,
      seriesId: context.product.seriesId,
      seriesName: context.seriesName
    },
    male: context.sireProduct
      ? {
          id: context.sireProduct.id,
          code: context.sireProduct.code,
          name: context.sireProduct.name,
          sireCode: context.sireProduct.sireCode,
          damCode: context.sireProduct.damCode
        }
      : {
          code: context.saleBatch?.sireCodeSnapshot ?? null
        },
    batch: context.saleBatch
      ? {
          id: context.saleBatch.id,
          batchNo: context.saleBatch.batchNo,
          eggEventId: context.saleBatch.eggEventId,
          eventDateSnapshot: context.saleBatch.eventDateSnapshot.toISOString(),
          eggCountSnapshot: context.saleBatch.eggCountSnapshot,
          plannedQuantity: context.saleBatch.plannedQuantity,
          soldQuantity: context.saleBatch.soldQuantity
        }
      : null,
    grandparents: {
      sireSireCode: context.sireProduct?.sireCode ?? null,
      sireDamCode: context.sireProduct?.damCode ?? null,
      damSireCode: context.product.sireCode ?? null,
      damDamCode: context.product.damCode ?? null
    }
  }
}

export function buildCertificateSaleSnapshot(
  context: CertificateLineageContext,
  decimalToNumber: (value: Prisma.Decimal | null | undefined) => number | null
): Prisma.JsonObject | null {
  if (!context.saleBatch && !context.saleAllocation && !context.subjectMedia) {
    return null
  }

  return {
    batch: context.saleBatch
      ? {
          id: context.saleBatch.id,
          batchNo: context.saleBatch.batchNo,
          status: context.saleBatch.status,
          plannedQuantity: context.saleBatch.plannedQuantity,
          soldQuantity: context.saleBatch.soldQuantity,
          eventDateSnapshot: context.saleBatch.eventDateSnapshot.toISOString(),
          eggCountSnapshot: context.saleBatch.eggCountSnapshot,
          priceLow: decimalToNumber(context.saleBatch.priceLow),
          priceHigh: decimalToNumber(context.saleBatch.priceHigh)
        }
      : null,
    allocation: context.saleAllocation
      ? {
          id: context.saleAllocation.id,
          allocationNo: context.saleAllocation.allocationNo,
          buyerName: context.saleAllocation.buyerName,
          buyerAccountId: context.saleAllocation.buyerAccountId,
          buyerContact: context.saleAllocation.buyerContact,
          quantity: context.saleAllocation.quantity,
          unitPrice: decimalToNumber(context.saleAllocation.unitPrice),
          channel: context.saleAllocation.channel,
          campaignId: context.saleAllocation.campaignId,
          soldAt: context.saleAllocation.soldAt.toISOString()
        }
      : null,
    subjectMedia: context.subjectMedia
      ? {
          id: context.subjectMedia.id,
          label: context.subjectMedia.label,
          isPrimary: context.subjectMedia.isPrimary
        }
      : null
  }
}

export function buildCertificateWatermarkSnapshot(tenantName: string, watermarkText: string): Prisma.JsonObject {
  return {
    platformTemplate: 'merchant.only',
    tenantName,
    watermarkText
  }
}

export function mapToProductCertificate(
  row: PrismaProductCertificateModel,
  buildCertificateContentPath: (productId: string, certificateId: string) => string
): ProductCertificate {
  return {
    id: row.id,
    tenantId: row.tenantId,
    productId: row.productId,
    eggEventId: row.eggEventId,
    saleBatchId: row.saleBatchId,
    saleAllocationId: row.saleAllocationId,
    subjectMediaId: row.subjectMediaId,
    previousCertificateId: row.previousCertificateId,
    versionNo: row.versionNo,
    voidReason: row.voidReason,
    certNo: row.certNo,
    verifyId: row.verifyId,
    status: row.status as ProductCertificate['status'],
    templateVersion: row.templateVersion,
    lineageSnapshot: row.lineageSnapshot,
    saleSnapshot: row.saleSnapshot,
    watermarkSnapshot: row.watermarkSnapshot,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes.toString(),
    contentPath: buildCertificateContentPath(row.productId, row.id),
    issuedAt: row.issuedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

export function mapToProductCertificateCenterItem(
  row: PrismaProductCertificateModel & {
    product: { code: string; name: string | null }
    saleBatch: PrismaSaleBatchModel | null
    saleAllocation: PrismaSaleAllocationModel | null
    subjectMedia: PrismaSaleSubjectMediaModel | null
    eggEvent: { eventDate: Date } | null
  },
  toProductCertificate: (row: PrismaProductCertificateModel) => ProductCertificate,
  buildSaleSubjectMediaContentPath: (saleBatchId: string, mediaId: string) => string
): ProductCertificateCenterItem {
  return {
    certificate: toProductCertificate(row),
    femaleCode: row.product.code,
    productName: row.product.name,
    batchNo: row.saleBatch?.batchNo ?? null,
    allocationNo: row.saleAllocation?.allocationNo ?? null,
    buyerName: row.saleAllocation?.buyerName ?? null,
    channel: row.saleAllocation?.channel ?? null,
    subjectContentPath: row.subjectMedia
      ? buildSaleSubjectMediaContentPath(row.subjectMedia.saleBatchId, row.subjectMedia.id)
      : null,
    eggEventDate: row.eggEvent?.eventDate ? row.eggEvent.eventDate.toISOString() : null
  }
}

export function buildCertificateNo(productCode: string, issuedAt: Date): string {
  const y = issuedAt.getFullYear()
  const m = String(issuedAt.getMonth() + 1).padStart(2, '0')
  const d = String(issuedAt.getDate()).padStart(2, '0')
  const compactCode = productCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10) || 'PRODUCT'
  const suffix = randomUUID().replace(/-/g, '').toUpperCase().slice(0, 6)
  return `CERT-${y}${m}${d}-${compactCode}-${suffix}`
}

export function buildCertificateVerifyId(): string {
  return randomUUID().replace(/-/g, '').toUpperCase().slice(0, 32)
}

export function getCertificateMonthKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  return `${year}${month}`
}

export function buildCertificateQuota(monthKey: string, used: number, monthlyLimit: number): CertificateQuota {
  const safeUsed = Math.max(0, used)
  return {
    monthKey,
    limit: monthlyLimit,
    used: safeUsed,
    remaining: Math.max(0, monthlyLimit - safeUsed)
  }
}
