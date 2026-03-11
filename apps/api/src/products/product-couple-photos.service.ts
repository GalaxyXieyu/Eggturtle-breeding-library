import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { AuditAction, ErrorCode } from '@eggturtle/shared'
import type {
  GenerateProductCouplePhotoRequest,
  GenerateProductCouplePhotoResponse,
  GetCurrentProductCouplePhotoResponse,
  ListProductCouplePhotosResponse,
  ProductCouplePhoto
} from '@eggturtle/shared'
import type {
  Product as PrismaProduct,
  ProductCouplePhoto as PrismaProductCouplePhotoModel
} from '@prisma/client'

import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { PrismaService } from '../prisma.service'
import { buildWebpVariantKey, resolveAllowedMaxEdge, resizeToWebpMaxEdge } from '../images/image-variants'
import { SharesCoreService } from '../shares/shares-core.service'
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants'
import type { StorageProvider } from '../storage/storage.provider'

import { ProductGeneratedAssetsSupportService, type StoredContentResult } from './product-generated-assets-support.service'
import { renderCouplePhotoPng } from './rendering/generated-media-renderer'

const DEFAULT_COUPLE_PHOTO_TEMPLATE_VERSION = 'v1'

type CouplePhotoContext = {
  tenantId: string
  tenantName: string
  femaleProduct: PrismaProduct
  maleProduct: PrismaProduct
  femaleSeriesName: string | null
  femaleSeriesDescription: string | null
  maleSeriesName: string | null
  maleSeriesDescription: string | null
  femaleImageKey: string | null
  maleImageKey: string | null
}

@Injectable()
export class ProductCouplePhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly generatedAssetsSupportService: ProductGeneratedAssetsSupportService,
    private readonly sharesCoreService: SharesCoreService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider
  ) {}

  async generateCouplePhoto(
    tenantId: string,
    actorUserId: string,
    femaleProductId: string,
    payload: GenerateProductCouplePhotoRequest
  ): Promise<GenerateProductCouplePhotoResponse> {
    const context = await this.loadCouplePhotoContext(tenantId, femaleProductId)
    const templateVersion = payload.templateVersion?.trim() || DEFAULT_COUPLE_PHOTO_TEMPLATE_VERSION
    const watermarkSnapshot = {
      platformTemplate: 'merchant.only',
      tenantName: context.tenantName,
      watermarkText: this.generatedAssetsSupportService.buildWatermarkText(context.tenantName)
    }
    const generatedAt = new Date()
    const offspringUnitPrice = context.femaleProduct.offspringUnitPrice

    if (offspringUnitPrice === null) {
      throw new BadRequestException('请先填写子代单价，再生成夫妻图。')
    }

    if (!context.femaleImageKey || !context.maleImageKey) {
      throw new BadRequestException(
        '无法生成夫妻图：母龟和公龟都必须设置主图。'
      )
    }

    let femaleImage: Buffer | null = null
    let maleImage: Buffer | null = null
    try {
      const imageBuffers = await Promise.all([
        this.generatedAssetsSupportService.loadManagedImageBuffer(tenantId, context.femaleImageKey),
        this.generatedAssetsSupportService.loadManagedImageBuffer(tenantId, context.maleImageKey)
      ])
      femaleImage = imageBuffers[0]
      maleImage = imageBuffers[1]
    } catch {
      throw new InternalServerErrorException('夫妻图素材读取失败，请稍后重试。')
    }

    if (!femaleImage || !maleImage) {
      throw new BadRequestException(
        '无法基于当前素材生成夫妻图，请检查公母龟主图是否可用。'
      )
    }

    const qrPayload = await this.buildCouplePhotoQrPayload(
      tenantId,
      actorUserId,
      context.femaleProduct.id
    )

    let png: Buffer
    try {
      png = await renderCouplePhotoPng({
        style: {
          femaleCode: context.femaleProduct.code,
          maleCode: context.maleProduct.code,
          femaleSeriesName: context.femaleSeriesName ?? '未设置系列',
          femaleSeriesDescription: context.femaleSeriesDescription ?? '暂无系列介绍',
          maleSeriesName: context.maleSeriesName ?? '未设置系列',
          maleSeriesDescription: context.maleSeriesDescription ?? '暂无系列介绍',
          femaleShortDescription: context.femaleProduct.description ?? '',
          maleShortDescription: context.maleProduct.description ?? '',
          priceLabel: `¥${offspringUnitPrice.toFixed(2)}`,
          generatedAtLabel: `生成时间：${this.generatedAssetsSupportService.formatDateTime(generatedAt)}`,
          watermarkText: this.generatedAssetsSupportService.buildWatermarkText(context.tenantName)
        },
        femaleImage,
        maleImage,
        qrPayload: qrPayload ?? undefined
      })
    } catch {
      throw new BadRequestException(
        '无法基于当前素材生成夫妻图，请检查公母龟主图是否可用。'
      )
    }

    const key = this.generatedAssetsSupportService.buildCouplePhotoStorageKey(tenantId, context.femaleProduct.id)
    let uploadResult: { key: string; url: string; contentType: string | null } | null = null

    try {
      uploadResult = await this.generatedAssetsSupportService.putObject({
        key,
        body: png,
        contentType: 'image/png',
        metadata: {
          tenantId,
          productId: context.femaleProduct.id,
          source: 'product.couple_photo'
        }
      })

      const photo = await this.prisma.$transaction(async (tx) => {
        await tx.productCouplePhoto.updateMany({
          where: {
            tenantId,
            femaleProductId: context.femaleProduct.id,
            isCurrent: true
          },
          data: {
            isCurrent: false,
            staleReason: 'replaced'
          }
        })

        return tx.productCouplePhoto.create({
          data: {
            tenantId,
            femaleProductId: context.femaleProduct.id,
            maleProductIdSnapshot: context.maleProduct.id,
            femaleCodeSnapshot: context.femaleProduct.code,
            maleCodeSnapshot: context.maleProduct.code,
            femaleImageKeySnapshot: context.femaleImageKey,
            maleImageKeySnapshot: context.maleImageKey,
            priceSnapshot: offspringUnitPrice,
            templateVersion,
            watermarkSnapshot,
            imageKey: uploadResult?.key ?? key,
            imageUrl: uploadResult?.url ?? '',
            contentType: uploadResult?.contentType ?? 'image/png',
            sizeBytes: BigInt(png.length),
            generatedAt,
            generatedByUserId: actorUserId,
            isCurrent: true,
            staleReason: null
          }
        })
      })

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductCouplePhotoGenerate,
        resourceType: 'product_couple_photo',
        resourceId: photo.id,
        metadata: {
          femaleProductId: context.femaleProduct.id,
          maleProductId: context.maleProduct.id,
          templateVersion
        }
      })

      return {
        photo: this.toProductCouplePhoto(photo)
      }
    } catch (error) {
      if (uploadResult?.key) {
        await this.generatedAssetsSupportService.deleteObject(uploadResult.key).catch(() => undefined)
      }

      throw error
    }
  }

  async getCurrentCouplePhoto(
    tenantId: string,
    femaleProductId: string
  ): Promise<GetCurrentProductCouplePhotoResponse> {
    await this.generatedAssetsSupportService.findProductOrThrow(tenantId, femaleProductId)

    const row = await this.prisma.productCouplePhoto.findFirst({
      where: {
        tenantId,
        femaleProductId,
        isCurrent: true
      },
      orderBy: [{ generatedAt: 'desc' }, { createdAt: 'desc' }]
    })

    return {
      photo: row ? this.toProductCouplePhoto(row) : null
    }
  }

  async listCouplePhotosHistory(
    tenantId: string,
    femaleProductId: string
  ): Promise<ListProductCouplePhotosResponse> {
    await this.generatedAssetsSupportService.findProductOrThrow(tenantId, femaleProductId)

    const rows = await this.prisma.productCouplePhoto.findMany({
      where: {
        tenantId,
        femaleProductId
      },
      orderBy: [{ generatedAt: 'desc' }, { createdAt: 'desc' }]
    })

    return {
      items: rows.map((item) => this.toProductCouplePhoto(item))
    }
  }

  async getCouplePhotoContent(
    tenantId: string,
    femaleProductId: string,
    photoId: string,
    options?: {
      maxEdge?: number
    }
  ): Promise<StoredContentResult> {
    const photo = await this.prisma.productCouplePhoto.findFirst({
      where: {
        id: photoId,
        tenantId,
        femaleProductId
      },
      select: {
        imageKey: true,
        imageUrl: true,
        contentType: true
      }
    })

    if (!photo) {
      throw new NotFoundException({
        message: '未找到夫妻图记录。',
        errorCode: ErrorCode.ProductCouplePhotoNotFound
      })
    }

    const maxEdge = resolveAllowedMaxEdge(options?.maxEdge)
    if (!this.isManagedStorageKey(tenantId, photo.imageKey)) {
      const redirectUrl = (photo.imageUrl ?? '').trim()
      if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
        throw new NotFoundException({
          message: '夫妻图内容不存在。',
          errorCode: ErrorCode.ProductCouplePhotoNotFound
        })
      }

      return {
        redirectUrl,
        contentType: photo.contentType
      }
    }

    try {
      if (maxEdge) {
        const variantKey = buildWebpVariantKey(photo.imageKey, maxEdge)
        try {
          const variantObject = await this.storageProvider.getObject(variantKey)
          return {
            content: variantObject.body,
            contentType: variantObject.contentType ?? photo.contentType
          }
        } catch (error) {
          if (!(error instanceof NotFoundException)) {
            throw error
          }
        }
      }

      const storedObject = await this.storageProvider.getObject(photo.imageKey)
      const resized = maxEdge ? await resizeToWebpMaxEdge({ body: storedObject.body, maxEdge }) : null

      if (maxEdge && resized) {
        const variantKey = buildWebpVariantKey(photo.imageKey, maxEdge)
        void this.storageProvider
          .putObject({
            key: variantKey,
            body: resized.body,
            contentType: resized.contentType,
            metadata: {
              source: 'product-couple-photo-variant',
              originalKey: photo.imageKey,
              maxEdge: String(maxEdge)
            }
          })
          .catch(() => undefined)
      }

      return {
        content: resized?.body ?? storedObject.body,
        contentType: resized?.contentType ?? photo.contentType ?? storedObject.contentType
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          message: '夫妻图内容不存在。',
          errorCode: ErrorCode.ProductCouplePhotoNotFound
        })
      }

      throw error
    }
  }

  private isManagedStorageKey(tenantId: string, key: string): boolean {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '')
    return normalized.startsWith(`${tenantId}/`)
  }

  private async buildCouplePhotoQrPayload(
    tenantId: string,
    actorUserId: string,
    productId: string
  ): Promise<string | null> {
    try {
      const share = await this.sharesCoreService.getOrCreateShare(
        tenantId,
        'tenant_feed',
        tenantId,
        null,
        actorUserId,
        undefined
      )
      const entryUrl = this.sharesCoreService.buildShareEntryUrl(share.shareToken)
      const joiner = entryUrl.includes('?') ? '&' : '?'
      return `${entryUrl}${joiner}pid=${encodeURIComponent(productId)}`
    } catch {
      return null
    }
  }

  private async loadCouplePhotoContext(tenantId: string, femaleProductId: string): Promise<CouplePhotoContext> {
    const [femaleProduct, tenant] = await Promise.all([
      this.generatedAssetsSupportService.findProductOrThrow(tenantId, femaleProductId),
      this.prisma.tenant.findUnique({
        where: {
          id: tenantId
        },
        select: {
          name: true
        }
      })
    ])

    if ((femaleProduct.sex ?? '').toLowerCase() !== 'female') {
      throw new BadRequestException('仅母种龟可生成夫妻图。')
    }

    if (!tenant) {
      throw new NotFoundException({
        message: '未找到租户。',
        errorCode: ErrorCode.TenantNotFound
      })
    }

    const mateCode = await this.generatedAssetsSupportService.resolveCurrentMateCode(tenantId, femaleProduct)
    if (!mateCode) {
      throw new BadRequestException('当前母种龟缺少有效的配偶编码。')
    }

    const maleProduct = await this.generatedAssetsSupportService.findProductByCode(tenantId, mateCode)
    if (!maleProduct) {
      throw new BadRequestException(`配偶编码 ${mateCode} 未匹配到有效公种龟。`)
    }

    if ((maleProduct.sex ?? '').toLowerCase() !== 'male') {
      throw new BadRequestException(`配偶编码 ${mateCode} 对应的不是公种龟。`)
    }

    const [femaleSeriesSummary, maleSeriesSummary, femaleImageKey, maleImageKey] = await Promise.all([
      this.generatedAssetsSupportService.resolveSeriesSummary(tenantId, femaleProduct.seriesId),
      this.generatedAssetsSupportService.resolveSeriesSummary(tenantId, maleProduct.seriesId),
      this.generatedAssetsSupportService.findMainImageKey(tenantId, femaleProduct.id),
      this.generatedAssetsSupportService.findMainImageKey(tenantId, maleProduct.id)
    ])

    return {
      tenantId,
      tenantName: tenant.name,
      femaleProduct,
      maleProduct,
      femaleSeriesName: femaleSeriesSummary.name,
      femaleSeriesDescription: femaleSeriesSummary.description,
      maleSeriesName: maleSeriesSummary.name,
      maleSeriesDescription: maleSeriesSummary.description,
      femaleImageKey,
      maleImageKey
    }
  }

  private toProductCouplePhoto(row: PrismaProductCouplePhotoModel): ProductCouplePhoto {
    return {
      id: row.id,
      tenantId: row.tenantId,
      femaleProductId: row.femaleProductId,
      maleProductIdSnapshot: row.maleProductIdSnapshot,
      femaleCodeSnapshot: row.femaleCodeSnapshot,
      maleCodeSnapshot: row.maleCodeSnapshot,
      templateVersion: row.templateVersion,
      watermarkSnapshot: row.watermarkSnapshot,
      priceSnapshot: row.priceSnapshot !== null ? row.priceSnapshot.toNumber() : null,
      isCurrent: row.isCurrent,
      staleReason: row.staleReason,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes.toString(),
      contentPath: this.generatedAssetsSupportService.buildCouplePhotoContentPath(row.femaleProductId, row.id),
      generatedAt: row.generatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }
}
