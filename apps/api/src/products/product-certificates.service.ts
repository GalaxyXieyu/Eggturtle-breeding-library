import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import {
  AuditAction,
  ErrorCode,
  type CertificateQuota,
  type ConfirmProductCertificateGenerateResponse,
  type GenerateProductCertificatePreviewResponse,
  type GetProductCertificateEligibilityResponse,
  type ListProductCertificateCenterResponse,
  type ListProductCertificatesResponse,
  type ProductCertificate,
  type ProductCertificateCenterItem,
  type ProductCertificateEligibilityRequirements,
  type ProductCertificateGenerateRequest,
  type ReissueProductCertificateRequest,
  type VoidProductCertificateRequest
} from '@eggturtle/shared'
import { Prisma } from '@prisma/client'
import type {
  ProductCertificate as PrismaProductCertificateModel,
  SaleAllocation as PrismaSaleAllocationModel,
  SaleBatch as PrismaSaleBatchModel,
  SaleSubjectMedia as PrismaSaleSubjectMediaModel
} from '@prisma/client'

import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { PrismaService } from '../prisma.service'

import { ProductGeneratedAssetsSupportService, type StoredContentResult } from './product-generated-assets-support.service'
import {
  buildCertificateEligibilityReasons,
  buildCertificateLineageSnapshot,
  buildCertificateNo,
  buildCertificateQuota,
  buildCertificateSaleSnapshot,
  buildCertificateVerifyId,
  buildCertificateWatermarkSnapshot,
  getCertificateMonthKey,
  mapToProductCertificate,
  mapToProductCertificateCenterItem,
  type CertificateLineageContext
} from './product-certificates.utils'
import { renderCertificatePng } from './rendering/generated-media-renderer'

const CERTIFICATE_MONTHLY_LIMIT = 100
const DEFAULT_CERTIFICATE_TEMPLATE_VERSION = 'v1'

@Injectable()
export class ProductCertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly generatedAssetsSupportService: ProductGeneratedAssetsSupportService
  ) {}

  async getCertificateEligibility(
    tenantId: string,
    productId: string
  ): Promise<GetProductCertificateEligibilityResponse> {
    const context = await this.loadCertificateLineageContext(tenantId, productId)
    const quota = await this.getCertificateQuota(tenantId)
    const reasons = this.buildEligibilityReasons(context.requirements, quota)

    return {
      eligible: reasons.length === 0,
      reasons,
      requirements: context.requirements,
      quota
    }
  }

  async previewCertificate(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: ProductCertificateGenerateRequest
  ): Promise<GenerateProductCertificatePreviewResponse> {
    const context = await this.loadCertificateLineageContext(tenantId, productId, payload)
    this.assertCertificateLineageEligible(context.requirements)

    const issuedAt = new Date()
    const certNo = this.buildCertificateNo(context.saleBatch?.batchNo || context.product.code, issuedAt)
    const verifyId = this.buildVerifyId()
    const quota = await this.getCertificateQuota(tenantId, this.getMonthKey(issuedAt))
    const templateVersion = payload.templateVersion?.trim() || DEFAULT_CERTIFICATE_TEMPLATE_VERSION
    const png = await this.renderCertificateImage({
      context,
      actorUserId,
      issuedAt,
      certNo,
      verifyId,
      templateVersion,
      buyerName: payload.buyerName,
      buyerAccountId: payload.buyerAccountId
    })

    return {
      preview: {
        certNo,
        verifyId,
        mimeType: 'image/png',
        imageBase64: png.toString('base64')
      },
      quota
    }
  }

  async confirmCertificate(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: ProductCertificateGenerateRequest
  ): Promise<ConfirmProductCertificateGenerateResponse> {
    const context = await this.loadCertificateLineageContext(tenantId, productId, payload)
    this.assertCertificateLineageEligible(context.requirements)

    const issuedAt = new Date()
    const quota = await this.getCertificateQuota(tenantId, this.getMonthKey(issuedAt))
    if (quota.remaining <= 0) {
      throw new ForbiddenException({
        message: 'Monthly certificate quota exceeded.',
        errorCode: ErrorCode.ProductCertificateQuotaExceeded
      })
    }

    const certNo = this.buildCertificateNo(context.saleBatch?.batchNo || context.product.code, issuedAt)
    const verifyId = this.buildVerifyId()
    const templateVersion = payload.templateVersion?.trim() || DEFAULT_CERTIFICATE_TEMPLATE_VERSION
    const png = await this.renderCertificateImage({
      context,
      actorUserId,
      issuedAt,
      certNo,
      verifyId,
      templateVersion,
      buyerName: payload.buyerName,
      buyerAccountId: payload.buyerAccountId
    })
    const watermarkSnapshot = this.buildWatermarkSnapshot(context.tenantName)
    const lineageSnapshot = this.buildLineageSnapshot(context)
    const saleSnapshot = this.buildSaleSnapshot(context)
    const imageKey = this.generatedAssetsSupportService.buildCertificateStorageKey(tenantId, context.product.id)

    let uploadResult: { key: string; url: string; contentType: string | null } | null = null

    try {
      uploadResult = await this.generatedAssetsSupportService.putObject({
        key: imageKey,
        body: png,
        contentType: 'image/png',
        metadata: {
          tenantId,
          productId: context.product.id,
          source: 'product.certificate'
        }
      })

      const { certificate, quota } = await this.prisma.$transaction(async (tx) => {
        const quotaResult = await this.consumeCertificateQuota(tx, tenantId, this.getMonthKey(issuedAt))
        const created = await tx.productCertificate.create({
          data: {
            tenantId,
            productId: context.product.id,
            eggEventId: context.saleBatch?.eggEventId ?? payload.eggEventId,
            saleBatchId: context.saleBatch?.id ?? payload.saleBatchId,
            saleAllocationId: context.saleAllocation?.id ?? payload.saleAllocationId,
            subjectMediaId: context.subjectMedia?.id ?? payload.subjectMediaId,
            certNo,
            verifyId,
            status: 'ISSUED',
            templateVersion,
            lineageSnapshot: lineageSnapshot as Prisma.InputJsonValue,
            saleSnapshot: saleSnapshot as Prisma.InputJsonValue,
            watermarkSnapshot: watermarkSnapshot as Prisma.InputJsonValue,
            imageKey: uploadResult?.key ?? imageKey,
            imageUrl: uploadResult?.url ?? '',
            contentType: uploadResult?.contentType ?? 'image/png',
            sizeBytes: BigInt(png.length),
            issuedAt,
            issuedByUserId: actorUserId
          }
        })

        return {
          certificate: created,
          quota: quotaResult
        }
      })

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductCertificateConfirm,
        resourceType: 'product_certificate',
        resourceId: certificate.id,
        metadata: {
          productId: context.product.id,
          saleBatchId: context.saleBatch?.id ?? null,
          saleAllocationId: context.saleAllocation?.id ?? null,
          certNo,
          verifyId,
          templateVersion
        }
      })

      return {
        certificate: this.toProductCertificate(certificate),
        quota
      }
    } catch (error) {
      if (uploadResult?.key) {
        await this.generatedAssetsSupportService.deleteObject(uploadResult.key).catch(() => undefined)
      }

      if (this.isCertificateConflict(error)) {
        throw new ConflictException('Certificate number conflict, please retry.')
      }

      throw error
    }
  }

  async listCertificates(tenantId: string, productId: string): Promise<ListProductCertificatesResponse> {
    await this.generatedAssetsSupportService.findProductOrThrow(tenantId, productId)

    const rows = await this.prisma.productCertificate.findMany({
      where: {
        tenantId,
        productId
      },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }]
    })

    return {
      items: rows.map((item) => this.toProductCertificate(item))
    }
  }

  async getCertificateContent(
    tenantId: string,
    productId: string,
    certificateId: string
  ): Promise<StoredContentResult> {
    const certificate = await this.prisma.productCertificate.findFirst({
      where: {
        id: certificateId,
        tenantId,
        productId
      },
      select: {
        imageKey: true,
        imageUrl: true,
        contentType: true
      }
    })

    if (!certificate) {
      throw new NotFoundException({
        message: 'Product certificate not found.',
        errorCode: ErrorCode.ProductCertificateNotFound
      })
    }

    return this.generatedAssetsSupportService.resolveStoredBinary(tenantId, certificate.imageKey, certificate.imageUrl, {
      notFoundMessage: 'Product certificate content not found.',
      errorCode: ErrorCode.ProductCertificateNotFound,
      contentType: certificate.contentType
    })
  }

  async listCertificateCenter(
    tenantId: string,
    query: { productId?: string; status?: ProductCertificate['status']; batchId?: string; q?: string; limit: number }
  ): Promise<ListProductCertificateCenterResponse> {
    const rows = await this.prisma.productCertificate.findMany({
      where: {
        tenantId,
        productId: query.productId,
        saleBatchId: query.batchId,
        status: query.status
      },
      include: {
        product: {
          select: {
            code: true,
            name: true
          }
        },
        saleBatch: true,
        saleAllocation: true,
        subjectMedia: true,
        eggEvent: {
          select: {
            eventDate: true
          }
        }
      },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.limit
    })

    const keyword = query.q?.trim().toLowerCase()
    const items = rows
      .filter((row) => {
        if (!keyword) {
          return true
        }

        return [
          row.certNo,
          row.verifyId,
          row.product.code,
          row.product.name,
          row.saleBatch?.batchNo,
          row.saleAllocation?.buyerName,
          row.saleAllocation?.allocationNo
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(keyword))
      })
      .map((row) => this.toProductCertificateCenterItem(row))

    return { items }
  }

  async voidCertificate(
    tenantId: string,
    actorUserId: string,
    certificateId: string,
    payload: VoidProductCertificateRequest
  ): Promise<{ certificate: ProductCertificate }> {
    const certificate = await this.prisma.productCertificate.findFirst({
      where: {
        id: certificateId,
        tenantId
      }
    })

    if (!certificate) {
      throw new NotFoundException({
        message: 'Product certificate not found.',
        errorCode: ErrorCode.ProductCertificateNotFound
      })
    }

    if (certificate.status !== 'ISSUED') {
      throw new BadRequestException({
        message: 'Certificate is already void.',
        errorCode: ErrorCode.ProductCertificateAlreadyVoid
      })
    }

    const updated = await this.prisma.productCertificate.update({
      where: {
        id: certificate.id
      },
      data: {
        status: 'VOID_MANUAL',
        voidReason: payload.voidReason ?? '手动作废'
      }
    })

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductCertificateVoid,
      resourceType: 'product_certificate',
      resourceId: updated.id,
      metadata: {
        voidReason: updated.voidReason
      }
    })

    return {
      certificate: this.toProductCertificate(updated)
    }
  }

  async previewReissueCertificate(
    tenantId: string,
    actorUserId: string,
    certificateId: string,
    payload: ReissueProductCertificateRequest
  ): Promise<GenerateProductCertificatePreviewResponse> {
    const certificate = await this.findReissuableCertificateOrThrow(tenantId, certificateId)
    const request = this.buildReissueGeneratePayload(certificate, payload)
    return this.previewCertificate(tenantId, actorUserId, certificate.productId, request)
  }

  async confirmReissueCertificate(
    tenantId: string,
    actorUserId: string,
    certificateId: string,
    payload: ReissueProductCertificateRequest
  ): Promise<ConfirmProductCertificateGenerateResponse> {
    const previousCertificate = await this.findReissuableCertificateOrThrow(tenantId, certificateId)
    const request = this.buildReissueGeneratePayload(previousCertificate, payload)
    const context = await this.loadCertificateLineageContext(tenantId, previousCertificate.productId, request)
    this.assertCertificateLineageEligible(context.requirements)

    const issuedAt = new Date()
    const quota = await this.getCertificateQuota(tenantId, this.getMonthKey(issuedAt))
    if (quota.remaining <= 0) {
      throw new ForbiddenException({
        message: 'Monthly certificate quota exceeded.',
        errorCode: ErrorCode.ProductCertificateQuotaExceeded
      })
    }

    const certNo = this.buildCertificateNo(context.saleBatch?.batchNo || context.product.code, issuedAt)
    const verifyId = this.buildVerifyId()
    const templateVersion = request.templateVersion?.trim() || DEFAULT_CERTIFICATE_TEMPLATE_VERSION
    const png = await this.renderCertificateImage({
      context,
      actorUserId,
      issuedAt,
      certNo,
      verifyId,
      templateVersion
    })
    const watermarkSnapshot = this.buildWatermarkSnapshot(context.tenantName)
    const lineageSnapshot = this.buildLineageSnapshot(context)
    const saleSnapshot = this.buildSaleSnapshot(context)
    const imageKey = this.generatedAssetsSupportService.buildCertificateStorageKey(tenantId, context.product.id)
    const voidReason = payload.voidReason?.trim() || '补发重开'

    let uploadResult: { key: string; url: string; contentType: string | null } | null = null

    try {
      uploadResult = await this.generatedAssetsSupportService.putObject({
        key: imageKey,
        body: png,
        contentType: 'image/png',
        metadata: {
          tenantId,
          productId: context.product.id,
          previousCertificateId: previousCertificate.id,
          source: 'product.certificate.reissue'
        }
      })

      const { certificate, quota: nextQuota } = await this.prisma.$transaction(async (tx) => {
        const quotaResult = await this.consumeCertificateQuota(tx, tenantId, this.getMonthKey(issuedAt))
        await tx.productCertificate.update({
          where: {
            id: previousCertificate.id
          },
          data: {
            status: 'VOID_SUPERSEDED',
            voidReason
          }
        })

        const created = await tx.productCertificate.create({
          data: {
            tenantId,
            productId: context.product.id,
            eggEventId: context.saleBatch?.eggEventId ?? request.eggEventId,
            saleBatchId: context.saleBatch?.id ?? request.saleBatchId,
            saleAllocationId: context.saleAllocation?.id ?? request.saleAllocationId,
            subjectMediaId: context.subjectMedia?.id ?? request.subjectMediaId,
            previousCertificateId: previousCertificate.id,
            versionNo: previousCertificate.versionNo + 1,
            certNo,
            verifyId,
            status: 'ISSUED',
            templateVersion,
            lineageSnapshot: lineageSnapshot as Prisma.InputJsonValue,
            saleSnapshot: saleSnapshot as Prisma.InputJsonValue,
            watermarkSnapshot: watermarkSnapshot as Prisma.InputJsonValue,
            imageKey: uploadResult?.key ?? imageKey,
            imageUrl: uploadResult?.url ?? '',
            contentType: uploadResult?.contentType ?? 'image/png',
            sizeBytes: BigInt(png.length),
            issuedAt,
            issuedByUserId: actorUserId
          }
        })

        return {
          certificate: created,
          quota: quotaResult
        }
      })

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductCertificateReissue,
        resourceType: 'product_certificate',
        resourceId: certificate.id,
        metadata: {
          previousCertificateId: previousCertificate.id,
          saleBatchId: context.saleBatch?.id ?? null,
          saleAllocationId: context.saleAllocation?.id ?? null,
          certNo,
          verifyId,
          versionNo: previousCertificate.versionNo + 1,
          voidReason
        }
      })

      return {
        certificate: this.toProductCertificate(certificate),
        quota: nextQuota
      }
    } catch (error) {
      if (uploadResult?.key) {
        await this.generatedAssetsSupportService.deleteObject(uploadResult.key).catch(() => undefined)
      }
      throw error
    }
  }

  private async loadCertificateLineageContext(
    tenantId: string,
    productId: string,
    payload?: Pick<
      ProductCertificateGenerateRequest,
      'eggEventId' | 'saleBatchId' | 'saleAllocationId' | 'subjectMediaId'
    >
  ): Promise<CertificateLineageContext> {
    const [product, tenant] = await Promise.all([
      this.generatedAssetsSupportService.findProductOrThrow(tenantId, productId),
      this.prisma.tenant.findUnique({
        where: {
          id: tenantId
        },
        select: {
          id: true,
          name: true
        }
      })
    ])

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      })
    }

    const [seriesName, saleBatch, saleAllocation, subjectMedia] = await Promise.all([
      this.generatedAssetsSupportService.resolveSeriesName(tenantId, product.seriesId),
      payload?.saleBatchId
        ? this.generatedAssetsSupportService.findSaleBatchOrThrow(tenantId, payload.saleBatchId, {
            femaleProductId: product.id,
            eggEventId: payload.eggEventId
          })
        : Promise.resolve(null),
      payload?.saleAllocationId
        ? this.generatedAssetsSupportService.findSaleAllocationOrThrow(tenantId, payload.saleAllocationId)
        : Promise.resolve(null),
      payload?.subjectMediaId
        ? this.generatedAssetsSupportService.findSaleSubjectMediaOrThrow(tenantId, payload.subjectMediaId)
        : Promise.resolve(null)
    ])

    if (saleAllocation && saleBatch && saleAllocation.saleBatchId !== saleBatch.id) {
      throw new BadRequestException({
        message: 'Sale allocation does not belong to selected batch.',
        errorCode: ErrorCode.InvalidRequestPayload
      })
    }

    if (subjectMedia && saleBatch && subjectMedia.saleBatchId !== saleBatch.id) {
      throw new BadRequestException({
        message: 'Subject media does not belong to selected batch.',
        errorCode: ErrorCode.InvalidRequestPayload
      })
    }

    const sireCode =
      saleBatch?.sireCodeSnapshot ?? (await this.generatedAssetsSupportService.resolveCurrentMateCode(tenantId, product))
    const [sireProduct, sireImageKey, damImageKey] = await Promise.all([
      this.generatedAssetsSupportService.findProductByCode(tenantId, sireCode),
      sireCode ? this.generatedAssetsSupportService.findMainImageKeyByCode(tenantId, sireCode) : Promise.resolve(null),
      this.generatedAssetsSupportService.findMainImageKey(tenantId, product.id)
    ])

    const subjectImageKey =
      subjectMedia?.imageKey ?? (await this.generatedAssetsSupportService.findMainImageKey(tenantId, product.id))

    const hasSireGrandparentTrace = Boolean(
      this.generatedAssetsSupportService.normalizeOptionalCode(sireProduct?.sireCode) ||
        this.generatedAssetsSupportService.normalizeOptionalCode(sireProduct?.damCode)
    )
    const hasDamGrandparentTrace = Boolean(
      this.generatedAssetsSupportService.normalizeOptionalCode(product.sireCode) ||
        this.generatedAssetsSupportService.normalizeOptionalCode(product.damCode)
    )
    const requirements: ProductCertificateEligibilityRequirements = {
      hasSireCode: Boolean(sireCode),
      hasDamCode: Boolean(product.code),
      hasParentGrandparentTrace: hasSireGrandparentTrace || hasDamGrandparentTrace
    }

    return {
      tenantId,
      tenantName: tenant.name,
      product,
      saleBatch,
      saleAllocation,
      subjectMedia,
      seriesName,
      sireProduct,
      subjectImageKey,
      sireImageKey,
      damImageKey,
      requirements
    }
  }

  private async renderCertificateImage(input: {
    context: CertificateLineageContext
    actorUserId: string
    issuedAt: Date
    certNo: string
    verifyId: string
    templateVersion: string
    buyerName?: string
    buyerAccountId?: string
  }): Promise<Buffer> {
    const [subjectImage, sireImage, damImage, issuer] = await Promise.all([
      this.generatedAssetsSupportService.loadManagedImageBuffer(input.context.tenantId, input.context.subjectImageKey),
      this.generatedAssetsSupportService.loadManagedImageBuffer(input.context.tenantId, input.context.sireImageKey),
      this.generatedAssetsSupportService.loadManagedImageBuffer(input.context.tenantId, input.context.damImageKey),
      this.resolveIssuerInfo(input.actorUserId)
    ])

    const style = {
      certNo: input.certNo,
      issuedOnText: this.generatedAssetsSupportService.formatDateYmd(input.issuedAt),
      issuedOnChineseText: this.generatedAssetsSupportService.formatDateChinese(input.issuedAt),
      lineName:
        input.context.saleBatch?.batchNo || input.context.product.name?.trim() || input.context.product.code,
      lineCode: input.context.saleBatch?.batchNo || input.context.product.code,
      lineFamily: input.context.seriesName ?? '未设定',
      damName: input.context.product.name?.trim() || input.context.product.code || '未登记',
      damCode: input.context.product.code || '未登记',
      sireCode: input.context.sireProduct?.code || input.context.saleBatch?.sireCodeSnapshot || '未登记',
      damCodeValue: input.context.product.code || '未登记',
      sireSireCode: input.context.sireProduct?.sireCode || '未登记',
      sireDamCode: input.context.sireProduct?.damCode || '未登记',
      damSireCode: input.context.product.sireCode || '未登记',
      damDamCode: input.context.product.damCode || '未登记',
      buyerName: input.context.saleAllocation?.buyerName || input.buyerName?.trim() || '未登记',
      buyerAccountId: input.context.saleAllocation?.buyerAccountId || input.buyerAccountId?.trim() || '未填写',
      sellerName: issuer.name,
      sellerAccountId: issuer.id,
      verifyId: input.verifyId,
      watermarkText: this.generatedAssetsSupportService.buildWatermarkText(input.context.tenantName)
    }

    return renderCertificatePng({
      style,
      verifyUrl: this.generatedAssetsSupportService.buildPublicVerifyUrl(input.verifyId),
      subjectImage,
      sireImage,
      damImage
    })
  }

  private buildEligibilityReasons(
    requirements: ProductCertificateEligibilityRequirements,
    quota?: CertificateQuota
  ): string[] {
    return buildCertificateEligibilityReasons(requirements, quota)
  }

  private assertCertificateLineageEligible(requirements: ProductCertificateEligibilityRequirements): void {
    const reasons = this.buildEligibilityReasons(requirements)
    if (reasons.length === 0) {
      return
    }

    throw new BadRequestException({
      message: 'Product is not eligible for certificate generation.',
      errorCode: ErrorCode.ProductCertificateEligibilityFailed,
      data: {
        reasons,
        requirements
      }
    })
  }

  private buildLineageSnapshot(context: CertificateLineageContext): Prisma.JsonObject {
    return buildCertificateLineageSnapshot(context, DEFAULT_CERTIFICATE_TEMPLATE_VERSION)
  }

  private buildSaleSnapshot(context: CertificateLineageContext): Prisma.JsonObject | null {
    return buildCertificateSaleSnapshot(context, this.generatedAssetsSupportService.decimalToNumber.bind(this.generatedAssetsSupportService))
  }

  private buildWatermarkSnapshot(tenantName: string): Prisma.JsonObject {
    return buildCertificateWatermarkSnapshot(
      tenantName,
      this.generatedAssetsSupportService.buildWatermarkText(tenantName)
    )
  }

  private async resolveIssuerInfo(userId: string): Promise<{ name: string; id: string }> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        name: true,
        account: true,
        email: true
      }
    })

    if (!user) {
      return {
        name: '未登记用户',
        id: userId
      }
    }

    const displayName = user.name?.trim() || user.account?.trim() || user.email.split('@')[0] || '未登记用户'
    return {
      name: displayName,
      id: user.id
    }
  }

  private async getCertificateQuota(tenantId: string, monthKey = this.getMonthKey(new Date())): Promise<CertificateQuota> {
    const row = await this.prisma.tenantCertificateQuotaMonthly.findUnique({
      where: {
        tenantId_monthKey: {
          tenantId,
          monthKey
        }
      },
      select: {
        usedCount: true
      }
    })

    return this.buildQuota(monthKey, row?.usedCount ?? 0)
  }

  private async consumeCertificateQuota(
    tx: Prisma.TransactionClient,
    tenantId: string,
    monthKey: string
  ): Promise<CertificateQuota> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const existing = await tx.tenantCertificateQuotaMonthly.findUnique({
        where: {
          tenantId_monthKey: {
            tenantId,
            monthKey
          }
        },
        select: {
          usedCount: true
        }
      })

      if (!existing) {
        try {
          await tx.tenantCertificateQuotaMonthly.create({
            data: {
              tenantId,
              monthKey,
              usedCount: 1
            }
          })

          return this.buildQuota(monthKey, 1)
        } catch (error) {
          if (this.isQuotaConflict(error)) {
            continue
          }
          throw error
        }
      }

      const updated = await tx.tenantCertificateQuotaMonthly.updateMany({
        where: {
          tenantId,
          monthKey,
          usedCount: {
            lt: CERTIFICATE_MONTHLY_LIMIT
          }
        },
        data: {
          usedCount: {
            increment: 1
          }
        }
      })

      if (updated.count === 1) {
        const refreshed = await tx.tenantCertificateQuotaMonthly.findUnique({
          where: {
            tenantId_monthKey: {
              tenantId,
              monthKey
            }
          },
          select: {
            usedCount: true
          }
        })

        return this.buildQuota(monthKey, refreshed?.usedCount ?? CERTIFICATE_MONTHLY_LIMIT)
      }

      throw new ForbiddenException({
        message: 'Monthly certificate quota exceeded.',
        errorCode: ErrorCode.ProductCertificateQuotaExceeded
      })
    }

    throw new ConflictException('Failed to consume certificate quota. Please retry.')
  }

  private toProductCertificate(row: PrismaProductCertificateModel): ProductCertificate {
    return mapToProductCertificate(
      row,
      this.generatedAssetsSupportService.buildCertificateContentPath.bind(this.generatedAssetsSupportService)
    )
  }

  private toProductCertificateCenterItem(
    row: PrismaProductCertificateModel & {
      product: { code: string; name: string | null }
      saleBatch: PrismaSaleBatchModel | null
      saleAllocation: PrismaSaleAllocationModel | null
      subjectMedia: PrismaSaleSubjectMediaModel | null
      eggEvent: { eventDate: Date } | null
    }
  ): ProductCertificateCenterItem {
    return mapToProductCertificateCenterItem(
      row,
      this.toProductCertificate.bind(this),
      this.generatedAssetsSupportService.buildSaleSubjectMediaContentPath.bind(this.generatedAssetsSupportService)
    )
  }

  private async findReissuableCertificateOrThrow(
    tenantId: string,
    certificateId: string
  ): Promise<PrismaProductCertificateModel> {
    const certificate = await this.prisma.productCertificate.findFirst({
      where: {
        id: certificateId,
        tenantId
      }
    })

    if (!certificate) {
      throw new NotFoundException({
        message: 'Product certificate not found.',
        errorCode: ErrorCode.ProductCertificateNotFound
      })
    }

    if (certificate.status !== 'ISSUED') {
      throw new BadRequestException({
        message: 'Only issued certificates can be reissued.',
        errorCode: ErrorCode.ProductCertificateAlreadyVoid
      })
    }

    return certificate
  }

  private buildReissueGeneratePayload(
    certificate: Pick<
      PrismaProductCertificateModel,
      'eggEventId' | 'saleBatchId' | 'saleAllocationId' | 'subjectMediaId' | 'templateVersion'
    >,
    payload: ReissueProductCertificateRequest
  ): ProductCertificateGenerateRequest {
    const eggEventId = certificate.eggEventId?.trim()
    const saleBatchId = certificate.saleBatchId?.trim()
    const saleAllocationId = certificate.saleAllocationId?.trim()
    const subjectMediaId = payload.subjectMediaId?.trim() || certificate.subjectMediaId?.trim()

    if (!eggEventId || !saleBatchId || !saleAllocationId || !subjectMediaId) {
      throw new BadRequestException({
        message: 'Only sale-linked certificates can be reissued.',
        errorCode: ErrorCode.InvalidRequestPayload
      })
    }

    return {
      eggEventId,
      saleBatchId,
      saleAllocationId,
      subjectMediaId,
      templateVersion: payload.templateVersion?.trim() || certificate.templateVersion
    }
  }

  private buildCertificateNo(productCode: string, issuedAt: Date): string {
    return buildCertificateNo(productCode, issuedAt)
  }

  private buildVerifyId(): string {
    return buildCertificateVerifyId()
  }

  private getMonthKey(value: Date): string {
    return getCertificateMonthKey(value)
  }

  private buildQuota(monthKey: string, used: number): CertificateQuota {
    return buildCertificateQuota(monthKey, used, CERTIFICATE_MONTHLY_LIMIT)
  }

  private isQuotaConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false
    }

    if (error.code !== 'P2002') {
      return false
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : []
    return target.includes('tenant_id') && target.includes('month_key')
  }

  private isCertificateConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false
    }

    if (error.code !== 'P2002') {
      return false
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : []
    return target.includes('verify_id') || target.includes('cert_no')
  }
}
