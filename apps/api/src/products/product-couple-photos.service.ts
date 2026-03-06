import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
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

import { ProductGeneratedAssetsSupportService, type StoredContentResult } from './product-generated-assets-support.service'
import { renderCouplePhotoPng } from './rendering/generated-media-renderer'

const DEFAULT_COUPLE_PHOTO_TEMPLATE_VERSION = 'v1'

type CouplePhotoContext = {
  tenantId: string
  tenantName: string
  femaleProduct: PrismaProduct
  maleProduct: PrismaProduct
  seriesName: string | null
  femaleImageKey: string | null
  maleImageKey: string | null
}

@Injectable()
export class ProductCouplePhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly generatedAssetsSupportService: ProductGeneratedAssetsSupportService
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

    const [femaleImage, maleImage] = await Promise.all([
      this.generatedAssetsSupportService.loadManagedImageBuffer(tenantId, context.femaleImageKey),
      this.generatedAssetsSupportService.loadManagedImageBuffer(tenantId, context.maleImageKey)
    ])

    const png = await renderCouplePhotoPng({
      style: {
        femaleCode: context.femaleProduct.code,
        maleCode: context.maleProduct.code,
        lineLabel: context.seriesName ? `系别：${context.seriesName}` : '系别：未设置',
        priceLabel:
          context.femaleProduct.offspringUnitPrice !== null
            ? `种苗参考价：¥${context.femaleProduct.offspringUnitPrice.toFixed(2)}`
            : '种苗参考价：未设置',
        generatedAtLabel: `生成时间：${this.generatedAssetsSupportService.formatDateTime(generatedAt)}`,
        watermarkText: this.generatedAssetsSupportService.buildWatermarkText(context.tenantName)
      },
      femaleImage,
      maleImage
    })

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
            priceSnapshot: context.femaleProduct.offspringUnitPrice,
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
    photoId: string
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
        message: 'Product couple photo not found.',
        errorCode: ErrorCode.ProductCouplePhotoNotFound
      })
    }

    return this.generatedAssetsSupportService.resolveStoredBinary(tenantId, photo.imageKey, photo.imageUrl, {
      notFoundMessage: 'Product couple photo content not found.',
      errorCode: ErrorCode.ProductCouplePhotoNotFound,
      contentType: photo.contentType
    })
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
      throw new BadRequestException('Only female breeders can generate couple photos.')
    }

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      })
    }

    const mateCode = await this.generatedAssetsSupportService.resolveCurrentMateCode(tenantId, femaleProduct)
    if (!mateCode) {
      throw new BadRequestException('Current female breeder does not have a valid mate code.')
    }

    const maleProduct = await this.generatedAssetsSupportService.findProductByCode(tenantId, mateCode)
    if (!maleProduct) {
      throw new BadRequestException(`Mate code ${mateCode} does not match an existing male breeder.`)
    }

    if ((maleProduct.sex ?? '').toLowerCase() !== 'male') {
      throw new BadRequestException(`Mate code ${mateCode} does not reference a male breeder.`)
    }

    const [seriesName, femaleImageKey, maleImageKey] = await Promise.all([
      this.generatedAssetsSupportService.resolveSeriesName(tenantId, femaleProduct.seriesId),
      this.generatedAssetsSupportService.findMainImageKey(tenantId, femaleProduct.id),
      this.generatedAssetsSupportService.findMainImageKey(tenantId, maleProduct.id)
    ])

    return {
      tenantId,
      tenantName: tenant.name,
      femaleProduct,
      maleProduct,
      seriesName,
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
